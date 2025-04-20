import { useState } from 'react';

export default function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  async function verifyHandler(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError('');
      setResult(null);
      const proof = JSON.parse(proofInput);
      const res = await fetch('http://localhost:4001/zk-snark/verify-proof', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(proof)
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex flex-col items-center p-4">
        <form onSubmit={verifyHandler} className="w-full max-w-lg">
            <div className="form-control w-full mb-4">
                <label className="label">
                    <span className="label-text">Paste Proof JSON:</span>
                </label>
                <textarea 
                    className="textarea textarea-bordered h-64 w-full" 
                    value={proofInput} 
                    onChange={e => setProofInput(e.target.value)}
                />
            </div>
            
            <button className="btn btn-primary w-full" type="submit">Verify Proof</button>
            
            {result && (
                <div className="mt-4">
                    <h3 className="font-bold text-lg">Verification Result:</h3>
                    {result.valid ? 
                        <div className="alert alert-success">Valid Proof!</div> : 
                        <div className="alert alert-error">Invalid Proof.</div>
                    }
                </div>
            )}
            
            {error && (
                <div className="alert alert-error mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Error: {error}</span>
                </div>
            )}
        </form>
    </div>
  );
}