import { useState, useEffect } from 'react';

interface CountryForSelect {
    countryId: string;
    name: string;
    relationship: string;
}

const FamilyComponent = () => {
    const [modalMessage, setModalMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null); // To track success/error for modal styling
    const [availableParentCountries, setAvailableParentCountries] = useState<CountryForSelect[]>([]);

    const [formData, setFormData] = useState({
        familyId: '',
        name: '',
        location: '',
        treatment: '',
        contactNumber: '',
        adminName: '',
        capacity: '',
        parentCountryId: '', // Added for parent selection
    });
    console.log('Form data:', formData);

    useEffect(() => {
        const fetchCountriesForSelect = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/families`, {
                    method: 'GET',
                });
                if (response.ok) {
                    const data: CountryForSelect[] = await response.json();
                    setAvailableParentCountries(data);
                } else {
                    console.error('Failed to fetch countries for parent selection');
                }
            } catch (error) {
                console.error('Error fetching countries for parent selection:', error);
            }
        };

        fetchCountriesForSelect();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateFamily = async () => {
        setIsModalOpen(false); // Close previous modal if open

        // Transform formData to match backend DTO
        const payload = {
            countryId: formData.familyId, // Map hospitalId to countryId
            name: formData.name,
            location: formData.location,
            relationship: formData.treatment, // Map treatment to relationship
            contactNumber: formData.contactNumber,
            adminName: formData.adminName,
            capacity: formData.capacity,
            parentCountryId: formData.parentCountryId || undefined, // Send if selected, otherwise undefined
        };

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/families/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload), // Send the transformed payload
            });

            let result: { message?: string; [key: string]: any };
            try {
                result = await response.json();
                console.log("Backend response status:", response.status);
                console.log("Backend response body:", result);
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                const textResponse = await response.text();
                console.error("Backend response text:", textResponse);
                result = { message: textResponse || `Request failed with status: ${response.status}` };
            }

            if (response.ok) {
                setIsSuccess(true);
                setModalMessage('Base relation created successfully!');
            } else {
                setIsSuccess(false);
                console.error("Backend error response details:", result);
                setModalMessage(result?.message || `Failed to create Base relation (Status: ${response.status})`);
            }
            setIsModalOpen(true);
        } catch (error) {
            console.error('Base relation creation fetch/network error:', error);
            setIsSuccess(false);
            setModalMessage('An error occurred connecting to the server.');
            setIsModalOpen(true);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setModalMessage('');
        setIsSuccess(null);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold">ZK-SNARK Family Records</h1>
                    <p className="mb-4">Generate Family Record.</p>

                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">ID</span>
                                </label>
                                <input type="text"
                                    name="familyId"
                                    value={formData.familyId}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter ID" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Name</span>
                                </label>
                                <input type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter Relation name" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Location</span>
                                </label>
                                <input type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter location" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Status</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="capacity"
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Alive or Dead" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Contact Number</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="contactNumber"
                                    value={formData.contactNumber}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter contact number" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">E-mail</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="adminName"
                                    value={formData.adminName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter e-mail address" />
                            </div>
                        </div>
                        <select className="select select-bordered w-full"
                                name="treatment"
                                value={formData.treatment}
                                onChange={handleChange}
                                required>
                                <option disabled value="">Select Relationship</option>
                                <option>Father</option>
                                <option>Mother</option>
                                <option>GrandMother</option>
                                <option>GrandFather</option>
                                <option>GreatGrandMother</option>
                                <option>GreatGrandFather</option>
                            </select>
                        {/* Parent Country Selection Dropdown */}
                        <div className="form-control w-full mt-4">
                            <label className="label">
                                <span className="label-text font-medium">Parent Family Unit (Optional)</span>
                            </label>
                            <select
                                name="parentCountryId"
                                value={formData.parentCountryId}
                                onChange={handleChange}
                                className="select select-bordered w-full"
                            >
                                <option value="">None (This is a root family unit)</option>
                                {availableParentCountries.map((country) => (
                                    <option key={country.countryId} value={country.countryId}>
                                        {country.name} ({country.countryId}) - {country.relationship}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </form>

                    <div className="flex gap-2 mb-4 mt-4">
                        <button className="btn btn-primary" onClick={generateFamily}>Create Relation</button>
                    </div>
                </div>
            </div>

            {/* Modal Implementation */}
            {isModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box relative">
                        <button onClick={closeModal} className="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
                        <h3 className={`text-lg font-bold ${isSuccess ? 'text-success' : 'text-error'}`}>
                            {isSuccess ? 'Success!' : 'Error!'}
                        </h3>
                        <p className="py-4">{modalMessage}</p>
                        <div className="modal-action">
                            <button onClick={closeModal} className="btn">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FamilyComponent;