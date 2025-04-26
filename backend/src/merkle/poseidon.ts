

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