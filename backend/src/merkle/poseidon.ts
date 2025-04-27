

const baseUrl = 'http://172.29.14.163:8080';

export async function rustPoseidonHash(inputs: string[]): Promise<string> {
  console.log('[rustPoseidonHash] inputs', inputs);
  // Point this URL at your running Rust service!
  const endpoint = `${baseUrl}/poseidon-hash`;
  const body = JSON.stringify({ inputs });
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  });
  
  if (!resp.ok) {
    const errorMessage = await resp.text(); // Log the response text
    throw new Error(`Rust Poseidon returned ${resp.status}: ${errorMessage}`);
  }
  const data = await resp.json();
  if (!/^0x[0-9a-fA-F]{64}$/.test(data.hash))
    throw new Error(`Rust Poseidon hash malformed: ${data.hash}`);
  return data.hash;
}

/** Calls Rust to convert a string → Fr, returned as 0x... (32B BE hex) */
export async function rustStringToFr(s: string): Promise<string> {
  const resp = await fetch(`${baseUrl}/string-to-fr`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: s,
  });
  if (!resp.ok) throw new Error(`String to Fr conversion error: ${resp.status}`);
  const txt = await resp.text();
  return txt.replace(/["']/g, '');  // Ensures you get clean 0x...
}

export async function checkRustMerkle(
  leaf: string,
  path: string[],
  index: number,
  root: string,
) {
  const body = { leaf, path, index, root };

  const res = await fetch(`${baseUrl}/merkle-root-check-verbose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log("== Rust Merkle proof check ==");
  console.log(data);
  return data;
}
