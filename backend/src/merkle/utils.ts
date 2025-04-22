// src/merkle/utils.ts
import { createHash } from 'crypto';
import { Patient } from '../patients/patient.entity';
import * as circomlibjs from "circomlibjs";

export const BLS12_381_FR = BigInt(
  '0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001'
);

const FIELD_MODULUS = BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001');


export function stringToFrBytes(s: string): Buffer {
  const hash = createHash('sha256').update(Buffer.from(s, 'utf8')).digest(); // 32 bytes
  const hashInt = BigInt('0x' + hash.toString('hex'));
  const fieldInt = hashInt % BLS12_381_FR;
  let hex = fieldInt.toString(16);
  if (hex.length < 64) hex = '0'.repeat(64 - hex.length) + hex;
  return Buffer.from(hex, 'hex');
}

export function stringToFrBigInt(s: string): BigInt {
  if (!s || typeof s !== 'string') throw new Error("Field string cannot be empty");
  const hash = createHash('sha256').update(Buffer.from(s, 'utf8')).digest();
  const hashInt = BigInt('0x' + hash.toString('hex'));
  return hashInt % FIELD_MODULUS;
}

export function bigIntToBuffer(bi: BigInt): Buffer {
  let hex = bi.toString(16);
  if (hex.length < 64) hex = '0'.repeat(64 - hex.length) + hex;
  return Buffer.from(hex, 'hex'); // always length 32
}

export function toHex32Buf(buf: Buffer): string {
  if (!Buffer.isBuffer(buf) || buf.length !== 32)
    throw new Error(`Not a 32-byte buffer! Length: ${buf.length}`);
  return '0x' + buf.toString('hex');
}

export function toMerklePatientRow(p: Patient) {
  return {
    hospital_id: p.hospital?.hospitalId ?? '',
    treatment: p.treatment,
    patient_id: p.patientId,
  };
}


// Generate a fully valid field element in 0x + 64 hex digits (32 bytes)
export function randomFrHex(): string {
  while (true) {
    const buf = Buffer.from(Array.from({length: 32}, () => Math.floor(Math.random() * 256)));
    let bi = BigInt('0x'+buf.toString('hex'));
    bi = bi % FIELD_MODULUS;
    let hx = bi.toString(16);
    if (hx.length < 64) hx = '0'.repeat(64 - hx.length) + hx;
    // No all-zeros
    if (bi > 0n && hx.length === 64 && bi < FIELD_MODULUS)
      return '0x'+hx;
  }
}


// Input: array of BigInt, returns valid field 0x hex string
export async function poseidonHex(inputs: BigInt[]) {
  const poseidon = await circomlibjs.buildPoseidon();
  let val = poseidon(inputs); // returns BigInt < modulus
  let hex = val.toString(16).padStart(64, "0");
  return "0x"+hex;
}

export function assertIs32ByteHex(label: string, value: string) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} is not a valid 32-byte hex string: ${value}`);
  }
}

export function ensureBigInt(val: any): BigInt {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  // If Buffer or Uint8Array, parse as hex string to BigInt
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return BigInt('0x' + Buffer.from(val).toString('hex'));
  }
  // Some poseidon libs return object with .toString("dec") → force decimal string to BigInt
  if (val && typeof val.toString === 'function' && /^[0-9]+$/.test(val.toString())) {
    return BigInt(val.toString());
  }
  throw new Error('Cannot coerce value to BigInt: ' + val);
}