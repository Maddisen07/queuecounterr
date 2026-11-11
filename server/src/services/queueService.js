import { Token } from '../models/Token.js';
import { Counter } from '../models/Counter.js';
import { Sequence } from '../models/Sequence.js';
import { calculateWaitEstimates } from '../utils/waitEstimate.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Returns formatted date string 'YYYY-MM-DD'
 */
export function getTodayString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats sequence number to token label, e.g. Q-007
 */
export function formatTokenLabel(seq) {
  return `Q-${String(seq).padStart(3, '0')}`;
}

/**
 * Fetches the last completed service durations (up to limit, default 20)
 */
export async function getRecentCompletedDurations(limit = 20) {
  const completed = await Token.find({
    status: 'completed',
    serviceDurationSec: { $ne: null, $gte: 0 }
  })
    .sort({ completedAt: -1, updatedAt: -1 })
    .limit(limit)
    .select('serviceDurationSec');

  return completed.map(t => t.serviceDurationSec);
}

/**
 * Calculates current wait estimates across all open counters and waiting tokens
 */
export async function calculateQueueSnapshot() {
  const [allCounters, waitingTokens, completedDurations] = await Promise.all([
    Counter.find().populate('currentToken').sort({ createdAt: 1 }),
    Token.find({ status: 'waiting' }).sort({ createdAt: 1, number: 1 }),
    getRecentCompletedDurations(20)
  ]);

  const openCounters = allCounters.filter(c => c.isActive);

  const estimateResult = calculateWaitEstimates({
    openCounters,
    waitingTokens,
    completedDurations,
    now: Date.now()
  });

  const waitingWithEstimates = waitingTokens.map((token, index) => {
    const tokenIdStr = String(token._id);
    const estimatedWaitSec = estimateResult.tokenEstimates.get(tokenIdStr) ?? null;
    return {
      _id: token._id,
      label: token.label,
      number: token.number,
      day: token.day,
      customerName: token.customerName,
      note: token.note,
      status: token.status,
      createdAt: token.createdAt,
      position: index + 1,
      estimatedWaitSec
    };
  });

  return {
    counters: allCounters,
    waiting: waitingWithEstimates,
    averageServiceTimeSec: estimateResult.averageServiceTimeSec,
    openCounterCount: openCounters.length,
    estimatedWaitSecForNewArrival: estimateResult.nextArrivalWaitSec
  };
}

/**
 * Creates and issues a new token
 */
export async function issueToken({ customerName = '', note = '' }) {
  const trimmedName = typeof customerName === 'string' ? customerName.trim().slice(0, 60) : '';
  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 120) : '';

  const day = getTodayString();

  // Atomically increment daily sequence
  const sequenceDoc = await Sequence.findOneAndUpdate(
    { day },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const number = sequenceDoc.seq;
  const label = formatTokenLabel(number);

  const token = await Token.create({
    label,
    number,
    day,
    customerName: trimmedName,
    note: trimmedNote,
    status: 'waiting'
  });

  // Calculate position and estimated wait for the newly issued token
  const snapshot = await calculateQueueSnapshot();
  const tokenSnapshot = snapshot.waiting.find(t => String(t._id) === String(token._id));

  return {
    token,
    position: tokenSnapshot ? tokenSnapshot.position : 1,
    estimatedWaitSec: tokenSnapshot ? tokenSnapshot.estimatedWaitSec : null
  };
}

/**
 * Gets a token by ID with position and wait estimate if waiting
 */
export async function getTokenDetails(id) {
  const token = await Token.findById(id).populate('counter', 'name isActive');
  if (!token) {
    throw new AppError('Token not found', 404);
  }

  let position = null;
  let estimatedWaitSec = null;

  if (token.status === 'waiting') {
    const snapshot = await calculateQueueSnapshot();
    const tokenSnapshot = snapshot.waiting.find(t => String(t._id) === String(token._id));
    if (tokenSnapshot) {
      position = tokenSnapshot.position;
      estimatedWaitSec = tokenSnapshot.estimatedWaitSec;
    }
  }

  return {
    token,
    position,
    estimatedWaitSec
  };
}

/**
 * Cancels a waiting token
 */
export async function cancelToken(id) {
  const token = await Token.findById(id);
  if (!token) {
    throw new AppError('Token not found', 404);
  }

  if (token.status !== 'waiting') {
    throw new AppError(`Token cannot be cancelled because it is ${token.status}`, 409);
  }

  token.status = 'cancelled';
  token.completedAt = new Date();
  await token.save();

  return token;
}

/**
 * Calls the next waiting customer to a counter
 * Utilizes atomic conditional updates with rollback to prevent race conditions
 */
export async function callNextToCounter(counterId) {
  // 1. Check counter availability
  const counter = await Counter.findOne({
    _id: counterId,
    isActive: true,
    currentToken: null
  });

  if (!counter) {
    // Check if counter exists at all or is busy/inactive
    const existing = await Counter.findById(counterId);
    if (!existing) {
      throw new AppError('Counter not found', 404);
    }
    if (!existing.isActive) {
      throw new AppError('Counter is closed and cannot call customers', 409);
    }
    throw new AppError('Counter is already serving a customer', 409);
  }

  // 2. Fetch candidate waiting tokens in order
  const candidateTokens = await Token.find({ status: 'waiting' })
    .sort({ createdAt: 1, number: 1 })
    .limit(20);

  if (!candidateTokens || candidateTokens.length === 0) {
    throw new AppError('No customers waiting in queue', 404);
  }

  // 3. Concurrently-safe claim of the oldest waiting token
  let claimedToken = null;
  const now = new Date();

  for (const candidate of candidateTokens) {
    claimedToken = await Token.findOneAndUpdate(
      { _id: candidate._id, status: 'waiting' },
      { status: 'serving', counter: counter._id, calledAt: now },
      { new: true }
    );
    if (claimedToken) {
      break; // Successfully claimed
    }
  }

  if (!claimedToken) {
    throw new AppError('No customers waiting in queue', 404);
  }

  // 4. Atomically claim counter
  const updatedCounter = await Counter.findOneAndUpdate(
    { _id: counter._id, isActive: true, currentToken: null },
    { currentToken: claimedToken._id },
    { new: true }
  ).populate('currentToken');

  // If counter claim failed (e.g. concurrent call-next or status change)
  if (!updatedCounter) {
    // Revert claimed token back to waiting
    await Token.findByIdAndUpdate(claimedToken._id, {
      status: 'waiting',
      counter: null,
      calledAt: null
    });
    throw new AppError('Counter became unavailable while claiming customer', 409);
  }

  return {
    counter: updatedCounter,
    token: claimedToken
  };
}

/**
 * Marks current token at counter as completed and records duration
 */
export async function completeCurrentToken(counterId) {
  const counter = await Counter.findById(counterId);
  if (!counter) {
    throw new AppError('Counter not found', 404);
  }
  if (!counter.currentToken) {
    throw new AppError('Counter is not currently serving a customer', 409);
  }

  const token = await Token.findById(counter.currentToken);
  if (!token) {
    // Reset counter if referenced token vanished
    counter.currentToken = null;
    await counter.save();
    throw new AppError('Active token not found', 404);
  }

  const now = new Date();
  const calledAt = token.calledAt || token.updatedAt || now;
  const serviceDurationSec = Math.max(0, Math.round((now.getTime() - new Date(calledAt).getTime()) / 1000));

  token.status = 'completed';
  token.completedAt = now;
  token.serviceDurationSec = serviceDurationSec;
  await token.save();

  counter.currentToken = null;
  await counter.save();

  return {
    counter,
    token
  };
}

/**
 * Marks current customer as no-show (frees counter without recording duration)
 */
export async function noShowCurrentToken(counterId) {
  const counter = await Counter.findById(counterId);
  if (!counter) {
    throw new AppError('Counter not found', 404);
  }
  if (!counter.currentToken) {
    throw new AppError('Counter is not currently serving a customer', 409);
  }

  const token = await Token.findById(counter.currentToken);
  if (!token) {
    counter.currentToken = null;
    await counter.save();
    throw new AppError('Active token not found', 404);
  }

  token.status = 'no_show';
  token.completedAt = new Date();
  token.serviceDurationSec = null;
  await token.save();

  counter.currentToken = null;
  await counter.save();

  return {
    counter,
    token
  };
}

/**
 * Updates counter (rename or open/close)
 */
export async function updateCounter(counterId, { name, isActive }) {
  const counter = await Counter.findById(counterId);
  if (!counter) {
    throw new AppError('Counter not found', 404);
  }

  // Cannot close counter while serving a customer
  if (isActive === false && counter.currentToken) {
    throw new AppError('Cannot close counter while serving a customer. Complete or mark as no-show first.', 409);
  }

  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new AppError('Counter name cannot be empty', 400);
    }
    if (trimmed.length > 40) {
      throw new AppError('Counter name cannot exceed 40 characters', 400);
    }
    // Check if another counter has this name
    const existing = await Counter.findOne({ name: trimmed, _id: { $ne: counterId } });
    if (existing) {
      throw new AppError(`A counter named '${trimmed}' already exists`, 409);
    }
    counter.name = trimmed;
  }

  if (typeof isActive === 'boolean') {
    counter.isActive = isActive;
  }

  await counter.save();
  return counter.populate('currentToken');
}

/**
 * Deletes a counter (not allowed while serving)
 */
export async function deleteCounter(counterId) {
  const counter = await Counter.findById(counterId);
  if (!counter) {
    throw new AppError('Counter not found', 404);
  }

  if (counter.currentToken) {
    throw new AppError('Cannot delete counter while serving a customer.', 409);
  }

  await Counter.findByIdAndDelete(counterId);
  return { message: 'Counter deleted successfully' };
}

/**
 * Seeds default 'Counter 1' if no counters exist
 */
export async function seedDefaultCounter() {
  const count = await Counter.countDocuments();
  if (count === 0) {
    console.log('No counters found. Creating default "Counter 1"...');
    await Counter.create({ name: 'Counter 1', isActive: true });
    console.log('✔ Default "Counter 1" created.');
  }
}
