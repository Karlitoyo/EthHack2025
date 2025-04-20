import { useState } from 'react';

export default function GenerateProof() {
  const [patientId, setPatientId] = useState('');
  const [treatment, setTreatment] = useState('');
  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState('');

  async function submitHandler(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setProof(null);
    try {
      const res = await fetch('http://localhost:4001/zk-snark/generate-proof', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({patientId, treatment})
      });
      if (!res.ok) throw new Error(await res.text());
      setProof(await res.json());
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Generate ZK Proof</h2>
      <form onSubmit={submitHandler} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Patient ID</span>
          </label>
          <input 
            type="text" 
            value={patientId} 
            onChange={e => setPatientId(e.target.value)} 
            className="input input-bordered w-full" 
            required
          />
        </div>
        
        <div className="form-control">
          <label className="label">
            <span className="label-text">Treatment</span>
          </label>
          <input 
            type="text" 
            value={treatment} 
            onChange={e => setTreatment(e.target.value)} 
            className="input input-bordered w-full" 
            required
          />
        </div>
        
        <button type="submit" className="btn btn-primary mt-4">Generate Proof</button>
        
        {error && <div className="alert alert-error mt-4">{error}</div>}
        
        {proof && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Proof Generated:</h3>
            <textarea 
              readOnly 
              value={JSON.stringify(proof, null, 2)} 
              rows={8} 
              className="textarea textarea-bordered w-full font-mono text-sm"
            />
          </div>
        )}
      </form>
    </div>
  );
}