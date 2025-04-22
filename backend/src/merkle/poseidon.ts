import * as circomlibjs from 'circomlibjs';

let poseidonInstance: typeof circomlibjs.poseidon | null = null;

export async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await circomlibjs.buildPoseidon();
  }
  return poseidonInstance;
}
