import { useState, useEffect } from 'react';

interface Country {
    countryId: string;
    relationship: string;
    // Add other country properties if needed
}

const PatientComponent = () => {
    const [proof, setProof] = useState(null);
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [modalMessage, setModalMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [countries, setCountries] = useState<Country[]>([]);

    const [formData, setFormData] = useState({
        patientId: '',
        firstName: '',
        lastName: '',
        age: '',
        address: '',
        dateOfBirth: '',
        treatment: '',
        email: '',
        contactNumber: '',
        parentCountryId: '',
    });
    console.log('Form data:', formData);

    useEffect(() => {
        console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL); // Log the backend URL
        const fetchCountries = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/countries`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched countries data:', data); // Log the raw data
                    setCountries(data);
                } else {
                    console.error('Failed to fetch countries, status:', response.status);
                    const errorText = await response.text();
                    console.error('Error response text:', errorText);
                }
            } catch (error) {
                console.error('Error fetching countries:', error);
            }
        };

        fetchCountries();
    }, []);

    useEffect(() => {
        console.log('Countries state updated:', countries); // Log countries state when it changes
    }, [countries]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generatePatient = async () => {
        setIsModalOpen(false); // Close previous modal if open

        // Transform formData to match backend DTO
        const payload = {
            citizenId: formData.patientId, // Map patientId to citizenId
            firstName: formData.firstName,
            lastName: formData.lastName,
            age: formData.age,
            address: formData.address,
            dateOfBirth: formData.dateOfBirth,
            relationship: formData.treatment, // Map treatment to relationship
            email: formData.email,
            contactNumber: formData.contactNumber,
            parentCountryId: formData.parentCountryId,
        };

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/citizens/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload), // Send the transformed payload
            });
            let result: { message?: string };
            try {
                result = await response.json();
                console.log("Backend response status:", response.status); // Log status
                console.log("Backend response body:", result); // Log parsed body
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                const textResponse = await response.text(); // Try reading as text
                console.error("Backend response text:", textResponse);
                result = { message: textResponse || `Request failed with status: ${response.status}` }; // Create a fallback result
            }

            if (response.ok) {
                setIsValid(true);
                setModalMessage('Patient created successfully!');
            } else {
                setIsValid(false);
                console.error("Backend error response details:", result); // Log error specifically
                setModalMessage(result?.message || `Failed to create patient (Status: ${response.status})`);
            }
            setIsModalOpen(true); // Open modal after API call
        } catch (error) {
            console.error('Patient creation fetch/network error:', error); // Log catch error more specifically
            setIsValid(false);
            let displayMessage = 'An error occurred connecting to the server.';
            if (error instanceof Error) {
                console.error("Caught error details:", error.message);
            }
            setModalMessage(displayMessage);
            setIsModalOpen(true); // Open modal on catch
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setModalMessage('');
        setIsValid(null);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold">ZK-SNARK Family Records</h1>
                    <p className="mb-4">Generate Your Record.</p>

                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">ID</span>
                                </label>
                                <input type="text"
                                    name="patientId"
                                    value={formData.patientId}
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
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter name" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Surname</span>
                                </label>
                                <input type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    className="input input-bordered w-full"
                                    placeholder="Enter surname" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Age</span>
                                </label>
                                <input type="number"
                                    className="input input-bordered w-full"
                                    name="age"
                                    value={formData.age}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter age" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Contact Number</span>
                                </label>
                                <input type="number"
                                    className="input input-bordered w-full"
                                    name="contactNumber"
                                    value={formData.contactNumber}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter phone number" />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">E-mail</span>
                                </label>
                                <input type="text"
                                    className="input input-bordered w-full"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="E-mail" />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Address</span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered w-full"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                placeholder="Enter address"></textarea>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Date of Birth</span>
                            </label>
                            <input type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                required
                                autoComplete="off"
                                className="input input-bordered w-full" />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Your information</span>
                            </label>
                            <select className="select select-bordered w-full"
                                name="treatment"
                                value={formData.treatment}
                                onChange={handleChange}
                                required>
                                <option disabled value="">Select Relationship</option>
                                <option>Son</option>
                                <option>Grand Son</option>
                                <option>Great Grand Son</option>
                            </select>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Parent Family Unit</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                name="parentCountryId"
                                value={formData.parentCountryId}
                                onChange={handleChange}
                                required
                            >
                                <option value="" disabled>Select Parent Family Unit</option>
                                {countries.map((country) => (
                                    <option key={country.countryId} value={country.countryId}>
                                        {country.countryId} - {country.relationship}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </form>

                    <div className="flex gap-2 mb-4 mt-4">
                        <button className="btn btn-primary" onClick={generatePatient}>Create Patient</button>
                    </div>
                </div>
            </div>

            {/* Modal Implementation */}
            {isModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box relative">
                        <button onClick={closeModal} className="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
                        <h3 className={`text-lg font-bold ${isValid ? 'text-success' : 'text-error'}`}>
                            {isValid ? 'Success!' : 'Error!'}
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

export default PatientComponent;