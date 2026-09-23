import {
  randomBytes,
  scrypt as callbackScrypt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    callbackScrypt(password, salt, length, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}
const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const maxMemory = 32 * 1024 * 1024;

export const passwordMinLength = 12;
export const passwordMaxLength = 128;

export type PasswordValidationError = {
  code: string;
  message: string;
};

const dummySalt = Buffer.from("toktickit-dummy-salt");
const dummyPasswordHash = `scrypt$${cost}$${blockSize}$${parallelization}$${dummySalt.toString("base64url")}$${scryptSync(
  "toktickit-invalid-password",
  dummySalt,
  keyLength,
  { N: cost, r: blockSize, p: parallelization, maxmem: maxMemory },
).toString("base64url")}`;

export function validatePassword(
  password: unknown,
): PasswordValidationError | null {
  if (typeof password !== "string") {
    return {
      code: "PASSWORD_REQUIRED",
      message: "Password is required.",
    };
  }

  if (
    password.length < passwordMinLength ||
    password.length > passwordMaxLength
  ) {
    return {
      code: "PASSWORD_POLICY_INVALID",
      message: `Password must contain ${passwordMinLength}-${passwordMaxLength} characters.`,
    };
  }

  if (!/[A-Za-z]/.test(password)) {
    return {
      code: "PASSWORD_POLICY_INVALID",
      message: "Password must contain at least one letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      code: "PASSWORD_POLICY_INVALID",
      message: "Password must contain at least one number.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      code: "PASSWORD_POLICY_INVALID",
      message: "Password must contain at least one non-alphanumeric character.",
    };
  }

  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: maxMemory,
  });

  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

function parseHash(encodedHash: string) {
  const [algorithm, rawCost, rawBlockSize, rawParallelization, salt, key] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !rawCost ||
    !rawBlockSize ||
    !rawParallelization ||
    !salt ||
    !key
  ) {
    return null;
  }

  const parsedCost = Number(rawCost);
  const parsedBlockSize = Number(rawBlockSize);
  const parsedParallelization = Number(rawParallelization);
  if (
    parsedCost !== cost ||
    parsedBlockSize !== blockSize ||
    parsedParallelization !== parallelization
  ) {
    return null;
  }

  try {
    const decodedSalt = Buffer.from(salt, "base64url");
    const decodedKey = Buffer.from(key, "base64url");
    if (decodedSalt.length === 0 || decodedKey.length !== keyLength) {
      return null;
    }

    return {
      cost: parsedCost,
      blockSize: parsedBlockSize,
      parallelization: parsedParallelization,
      salt: decodedSalt,
      key: decodedKey,
    };
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parsed = parseHash(encodedHash);
  if (!parsed || parsed.key.length === 0 || parsed.salt.length === 0) {
    return false;
  }

  let derivedKey: Buffer;
  try {
    derivedKey = await deriveKey(password, parsed.salt, parsed.key.length, {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
      maxmem: maxMemory,
    });
  } catch {
    return false;
  }

  return (
    derivedKey.length === parsed.key.length &&
    timingSafeEqual(derivedKey, parsed.key)
  );
}

export async function verifyPasswordOrDummy(
  password: string,
  encodedHash: string | undefined,
) {
  return verifyPassword(password, encodedHash ?? dummyPasswordHash);
}
