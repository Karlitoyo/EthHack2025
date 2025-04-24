// src/merkle/utils.ts
import { createHash } from 'crypto';
import { Patient } from '../patients/patient.entity';
import * as circomlibjs from "circomlibjs";
import { PatientRow } from './interfaces/merkleTree';

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

export function stringToFrBigInt(s: string): bigint {
  if (!s || typeof s !== 'string') throw new Error("Field string cannot be empty");
  if (!s || typeof s !== 'string') {
    throw new Error(`Field string must be nonempty string, got: '${s}' (${typeof s})`);
  }
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

export function toMerklePatientRow(p: Patient): PatientRow | null {
  if (!p.hospital?.hospitalId) {
    console.warn("Skipping patient with missing hospital/hospitalId", p);
    return null;
  }
  if (!p.treatment || !p.patientId) {
    console.warn("Skipping patient missing treatment or patientId", p);
    return null;
  }
  return {
    hospital_id: String(p.hospital.hospitalId),
    treatment: String(p.treatment),
    patient_id: String(p.patientId),
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

export function ensureBigInt(x: any): bigint {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(x);
  if (typeof x === 'string') return BigInt(x);

  // Accept Node.js Buffer
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(x)) {
    return BigInt('0x' + x.toString('hex'));
  }
  // Accept Uint8Array or any TypedArray (such as from crypto, DB, web)
  if (x instanceof Uint8Array || (ArrayBuffer.isView(x) && 'BYTES_PER_ELEMENT' in x && x.BYTES_PER_ELEMENT === 1)) {
    return BigInt('0x' + Buffer.from(x.buffer, x.byteOffset, x.byteLength).toString('hex'));
  }
  // Accept raw [number, number, ...]
  if (Array.isArray(x) && x.length > 0 && typeof x[0] === 'number') {
    return BigInt('0x' + Buffer.from(x).toString('hex'));
  }

  throw new Error('Cannot coerce value to BigInt: ' + JSON.stringify(x));
}