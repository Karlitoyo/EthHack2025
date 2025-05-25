import { useState } from 'react';

export default function VerifyProof() {
  const [proofInput, setProofInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [showVideoOverlay, setShowVideoOverlay] = useState(false); // New state for overlay

  async function verifyHandler(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError('');
      setResult(null);
      const proof = JSON.parse(proofInput);

      if (!Array.isArray(proof.proof) || !Array.isArray(proof.public_inputs)) {
        throw new Error("Proof input must have 'proof' (array) and 'public_inputs' (array of arrays)");
      }
      if (
        !(
          proof.public_inputs.length === 2 &&
          Array.isArray(proof.public_inputs[0]) && proof.public_inputs[0].length === 32 &&
          Array.isArray(proof.public_inputs[1]) && proof.public_inputs[1].length === 32
        )
      ) {
        throw new Error("public_inputs must be an array of two 32-byte arrays");
      }

      const res = await fetch('http://localhost:4001/zk-snark/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof),
      });

      if (!res.ok) throw new Error(await res.text());
      const verificationResult = await res.json();
      setResult(verificationResult);
      if (verificationResult.valid) {
        setShowVideoOverlay(true); // Show overlay on valid proof
      }
    } catch (err) {
      setError(String(err));
    }
  }

  // IPFS video CID — change this if you're storing different CIDs dynamically later
  const ipfsCID = 'bafybeih7i7geos4gmvbxemgp44676fhe3tkodvebqwz5fzowrf6ghyojfy';
  const ipfsGatewayUrl = `https://gray-head-pony-173.mypinata.cloud/ipfs/${ipfsCID}`; // Switched to Cloudflare IPFS gateway

  const closeOverlay = () => {
    setShowVideoOverlay(false);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <form onSubmit={verifyHandler} className="w-full max-w-lg">
        <div className="form-control w-full mb-4">
          <span className="label-text">
            Paste Proof JSON:<br />
            <small>
              Expect <code>&#123;"proof":[...], "public_inputs": [[32b],[32b]]&#125;</code>
            </small>
          </span>
          <textarea
            className="textarea textarea-bordered h-64 w-full"
            value={proofInput}
            onChange={e => setProofInput(e.target.value)}
          />
        </div>

        <button className="btn btn-primary w-full" type="submit">Verify Proof</button>

        {/* Video Overlay - Rendered conditionally based on showVideoOverlay state */}
        {showVideoOverlay && result && result.valid && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4"
            onClick={closeOverlay} // Close overlay when clicking on the backdrop
          >
            <div 
              className="bg-white p-6 rounded-lg shadow-xl relative max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()} // Prevent clicks inside the modal from closing it
            >
              <button 
                onClick={closeOverlay} 
                className="absolute top-2 right-2 btn btn-sm btn-circle btn-ghost text-black"
              >
                ✕
              </button>
              <h3 className="font-bold text-2xl mb-4 text-center text-success">Valid Proof!</h3>
              {/* Ensure the video container clips its content and the video fits while maintaining aspect ratio */}
              <div className="aspect-w-16 aspect-h-9 w-full max-h-[70vh] overflow-hidden bg-black">
                <video className="w-full h-full object-contain" controls autoPlay muted>
                  <source src={ipfsGatewayUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-center mt-2 text-sm text-gray-600">
                Click outside or the '✕' to close.
              </p>
            </div>
          </div>
        )}

        {/* Original result display (optional, can be removed if overlay is sufficient) */}
        {result && !showVideoOverlay && (
          <div className="mt-4">
            <h3 className="font-bold text-lg">Verification Result:</h3>
            {result.valid ? (
              <div className="alert alert-success">
                Valid Proof! Video was shown in overlay.
              </div>
            ) : (
              <div className="alert alert-error">Invalid Proof.</div>
            )}
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error: {error}</span>
          </div>
        )}
      </form>
    </div>
  );
}
