import React, { useState } from 'react';
import { LineageData } from '../../interfaces'; // Import the updated interfaces

export default function FamilySearch() {
    const [citizenId, setCitizenId] = useState('');
    const [data, setData] = useState<LineageData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const errorModalRef = React.useRef<HTMLDialogElement>(null); // Declare the ref

    const fetchFamilyData = async () => {
        if (!citizenId.trim()) {
            setError('Please enter a Family ID.');
            setData(null); // Clear previous data if any
            return;
        }

        setLoading(true);
        setError(null); // Clear any previous error
        setData(null);

        let errorToShow: string | null = null;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/relation/lineage/${citizenId}`);

            if (!res.ok) {
                let errorPayloadMessage = `Error: ${res.status} ${res.statusText || 'Server Error'}`;
                try {
                    // Attempt to parse a JSON error response from the backend
                    const errorData = await res.json();
                    if (errorData && errorData.message) {
                        errorPayloadMessage = errorData.message;
                    }
                } catch (jsonError) {
                    // If the error response isn't JSON or parsing fails, log it and use the HTTP status based message
                    console.warn('Could not parse error response as JSON.', jsonError);
                }
                errorToShow = errorPayloadMessage; // Set message to be handled in finally
                console.error('API Error:', errorPayloadMessage); // Log API specific errors
            } else {
                // If response is OK, parse and set data
                const json: LineageData = await res.json();
                setData(json);
            }

        } catch (err: any) { // Catches network errors or issues with res.json() if res was ok
            console.error('Fetch/Processing Error:', err); // Log unexpected errors
            
            // Set a user-friendly error message
            errorToShow = (err instanceof Error && err.message) 
                               ? err.message 
                               : 'Failed to fetch family data. An unexpected network or parsing error occurred.';
        } finally {
            setLoading(false);
            if (errorToShow) {
                setError(errorToShow); // Update React state with the error message
                if (errorModalRef.current) {
                    errorModalRef.current.showModal(); // Show the error modal
                } else {
                    console.warn("Error modal ref is not available. Ensure 'errorModalRef' is defined and passed to a <dialog> element.");
                }
            }
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            {/* Error Modal Dialog */}
            <dialog id="error_modal" className="modal" ref={errorModalRef}>
                <div className="modal-box">
                    <h3 className="font-bold text-lg text-error">Error!</h3>
                    <p className="py-4">{error}</p>
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="btn">Close</button>
                        </form>
                    </div>
                </div>
            </dialog>

            <div className="card w-full max-w-7xl bg-base-100 shadow-xl mx-auto">
            <div className="card-body p-6 sm:p-8">
                <h2 className="card-title text-2xl md:text-3xl mb-6 text-center sm:text-left">
                Search Citizen Lineage by ID
                </h2>

                <div className="form-control w-full mb-6">
                <label className="label sr-only" htmlFor="citizenIdInput">Citizen ID</label>
                <div className="input-group input-group-lg">
                    <input
                    id="citizenIdInput"
                    type="text"
                    placeholder="Enter Citizen ID (e.g., CZN001)"
                    value={citizenId}
                    onChange={(e) => setCitizenId(e.target.value)}
                    className="input input-bordered w-full input-lg"
                    aria-label="Citizen ID Input"
                    />
                    <button
                    onClick={fetchFamilyData}
                    disabled={!citizenId.trim() || loading}
                    className="btn btn-primary btn-lg mt-10"
                    >
                    {loading ? <span className="loading loading-spinner"></span> : 'Search Lineage'}
                    </button>
                </div>
                </div>

                {error && (
                <div role="alert" className="alert alert-error my-6 animate-fadeIn">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                </div>
                )}

                {data && (
                <div className="mt-6 bg-base-200 shadow-xl rounded-lg p-4 sm:p-6">
                    <h2 className="text-2xl font-bold mb-4 text-center text-primary">Lineage Information</h2>
                    
                    {/* Target Relation Details - Displayed first */} 
                    {data.targetRelation && (
                        <div className="mb-6 pb-4 border-b border-base-300">
                            <h3 className="text-xl font-semibold mb-3 text-accent">Queried Individual</h3>
                            <div className="card bg-base-100 shadow-md p-4">
                                <p><strong>Name:</strong> {data.targetRelation.firstName} {data.targetRelation.lastName} (ID: {data.targetRelation.citizenId || 'N/A'})</p>
                                <p><strong>Age:</strong> {data.targetRelation.age}</p>
                                <p><strong>Relationship to their direct Family Unit:</strong> {data.targetRelation.relationshipToFamily || 'N/A'}</p>
                                {data.targetRelation.email && <p><strong>Email:</strong> {data.targetRelation.email}</p>}
                                {data.targetRelation.address && <p><strong>Address:</strong> {data.targetRelation.address}</p>}
                                {data.targetRelation.contactNumber && <p><strong>Contact:</strong> {data.targetRelation.contactNumber}</p>}
                            </div>
                        </div>
                    )}

                    {/* Lineage Path (Ancestral Family Units and their members) */} 
                    {data.lineagePath && data.lineagePath.length > 0 && (
                        <div className="mb-6 pb-4">
                            <h3 className="text-xl font-semibold mb-3 text-accent">Ancestral Lineage</h3>
                            <ul className="space-y-6">
                                {data.lineagePath.map((familyUnit, index) => (
                                    <li key={familyUnit.id} className="card bg-base-100 shadow-md p-4">
                                        <div className="mb-2">
                                            <h4 className="text-lg font-semibold">Family Unit: {familyUnit.name} (ID: {familyUnit.familyId || 'N/A'})</h4>
                                            <p className="text-sm text-gray-600">Location: {familyUnit.location}</p>
                                            <p className="text-sm text-gray-600">Role in Overall Lineage: {familyUnit.roleInFamily || 'N/A'}</p>
                                        </div>
                                        {familyUnit.members && familyUnit.members.length > 0 && (
                                            <div>
                                                <h5 className="font-medium mb-1">Members of this Family Unit:</h5>
                                                <ul className="list-disc list-inside pl-4 space-y-1 text-sm">
                                                    {familyUnit.members.map(member => (
                                                        <li key={member.id}>
                                                            {member.firstName} {member.lastName} (ID: {member.citizenId || 'N/A'}) - Role: {member.relationshipToFamily || 'N/A'}
                                                            {/* Display other member details if needed, e.g., age, email */} 
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {(!familyUnit.members || familyUnit.members.length === 0) && (
                                            <p className="text-sm text-gray-500 italic">No direct members listed for this specific family unit in the lineage path.</p>
                                        )}
                                        {/* Visual connector for lineage if not the last item */} 
                                        {index < data.lineagePath.length - 1 && (
                                            <div className="flex justify-center my-3">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                                                    <path d="M12 5V19M12 19L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M12 19L8 15M12 19L16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Siblings Details - Displayed last */} 
                    {data.siblings && data.siblings.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-base-300">
                            <h3 className="text-xl font-semibold mb-3 text-accent">Siblings (Members of the same direct Family Unit as Queried Individual)</h3>
                            <ul className="space-y-3">
                                {data.siblings.map(sibling => (
                                    <li key={sibling.id} className="card bg-base-100 shadow-md p-3">
                                        <p><strong>Name:</strong> {sibling.firstName} {sibling.lastName} (ID: {sibling.citizenId || 'N/A'})</p>
                                        <p className="text-sm">Role: {sibling.relationshipToFamily || 'N/A'}</p>
                                        {/* Display other sibling details if needed */} 
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!data.targetRelation && !data.lineagePath?.length && !data.siblings?.length && (
                        <p className="text-center text-info py-5">No lineage or sibling information available for this individual.</p>
                    )}
                </div>
                )}

                {!loading && !data && !error && (
                <div className="text-center py-10 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-base-content opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.242-4.242 3 3 0 00-4.242 4.242zM10 17h4" />
                    </svg>
                    <p className="mt-2 text-xl text-base-content opacity-70">Enter a Citizen ID to search.</p>
                    <p className="text-sm text-base-content opacity-50">Family lineage and sibling information will be displayed here.</p>
                </div>
                )}
            </div>
            </div>
        </div>
    );
}
