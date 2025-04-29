import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Define the type for the modal content
interface ModalContent {
  title: string;
  body: string;
}

export default function GenerateProof() {
  const [patientId, setPatientId] = useState('');
  const [treatment, setTreatment] = useState('');
  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState('');

  // State for controlling the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  // Loading states
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  async function submitHandler(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setProof(null);
    setIsModalOpen(false);
    setModalContent(null);
    setIsGeneratingProof(true); // Start loading

    try {
      // 1. Generate proof
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/zk-snark/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, treatment })
      });
      if (!res.ok) throw new Error(await res.text());
      const proofJson = await res.json();
      setProof(proofJson);

    } catch (err) {
      setError(String(err));
      setModalContent({ title: "Proof Generation Error", body: String(err) });
      setIsModalOpen(true);
    } finally {
      setIsGeneratingProof(false); // Stop loading
    }
  }

  // Function to handle closing the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  // Function to handle submitting the proof
  const handleSubmitProof = async () => {
    setError('');
    setIsModalOpen(false);
    setModalContent(null);
    setIsSubmittingProof(true);

    try {
      const submitRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ethereum/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proof.proof,
          public_inputs: proof.public_inputs
        })
      });

      if (!submitRes.ok) {
        // Throw error to be caught below
        throw new Error(`Submission failed: ${await submitRes.text()}`);
      }

      const submitResult = await submitRes.json();

      // Set modal content for success and open modal
      setModalContent({
        title: "Proof Submitted Successfully",
        body: `Proof logged on chain!\nTx hash: ${submitResult.transactionHash}\nSee on Etherscan: ${submitResult.etherscanUrl || 'N/A'}`
      });
      setIsModalOpen(true);

    } catch (err: any) {
      const errorMessage = err.message || String(err);
      // Set form-level error state
      setError(errorMessage);
      // Set modal content for error and open modal
      setModalContent({ title: "Submission Error", body: errorMessage });
      setIsModalOpen(true);
    } finally {
      setIsSubmittingProof(false); // Stop submitting loading
    }
  };


  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Toaster position="top-center" reverseOrder={false} />
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
            disabled={isGeneratingProof || isSubmittingProof}
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
            disabled={isGeneratingProof || isSubmittingProof}
          />
        </div>

        <button
          type="submit"
          className={`btn btn-primary mt-4 ${isGeneratingProof ? 'loading' : ''}`}
          disabled={isGeneratingProof || isSubmittingProof}
        >
          {isGeneratingProof ? 'Generating...' : 'Generate Proof'}
        </button>

        {error && !isModalOpen && <div className="alert alert-error mt-4">{error}</div>}

        {proof && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Proof Generated:</h3>
            <textarea
              readOnly
              value={JSON.stringify(proof, null, 2)}
              rows={8}
              className="textarea textarea-bordered w-full font-mono text-sm max-h-64 overflow-y-auto"
              id="proof-textarea"
            />
            <div className="flex space-x-2 mt-4">
              <button
                type="button"
                className={`btn btn-secondary ${isSubmittingProof ? 'loading' : ''}`}
                onClick={handleSubmitProof}
                disabled={!proof || isSubmittingProof || isGeneratingProof}
              >
                {isSubmittingProof ? 'Submitting...' : 'Submit Proof On-Chain'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(proof, null, 2))
                    .then(() => {
                        toast.success('Proof copied successfully!');
                      console.log('Proof copied to clipboard!');
                    })
                    .catch(err => {
                      console.error('Failed to copy proof: ', err);
                      toast.error('Failed to copy Proof!');
                    });
                }}
                disabled={!proof || isGeneratingProof || isSubmittingProof}
              >
                Copy Proof
              </button>
            </div>
          </div>
        )}
      </form>

      {/* DaisyUI Modal */}
      {isModalOpen && modalContent && (
        <dialog id="submission_modal" className="modal modal-open">
          <div className="modal-box modal-lg max-w-4xl">
            <h3 className="font-bold text-lg">{modalContent.title}</h3>
            {(() => {
              const body = modalContent.body;
              const linkPrefix = "See on Etherscan: ";
              const linkIndex = body.lastIndexOf(linkPrefix);

              if (linkIndex !== -1) {
              const textBeforeLink = body.substring(0, linkIndex);
              const url = body.substring(linkIndex + linkPrefix.length);

              // Check if the extracted URL is valid and not 'N/A'
              if (url && url !== 'N/A' && (url.startsWith('http://') || url.startsWith('https://'))) {
                return (
                <div className="py-4">
                  <p className="whitespace-pre-wrap">{textBeforeLink}</p>
                  <p className="whitespace-pre-wrap">
                  {linkPrefix}
                  <a href={url} target="_blank" rel="noopener noreferrer" className="link link-primary break-all">
                    {url}
                  </a>
                  </p>
                </div>
                );
              }
              }
              // Fallback: Render the original body if no valid link is found
              return <p className="py-4 text-base whitespace-pre-wrap">{body}</p>;
            })()}
            <div className="modal-action">
              <button className="btn" onClick={closeModal}>Close</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
