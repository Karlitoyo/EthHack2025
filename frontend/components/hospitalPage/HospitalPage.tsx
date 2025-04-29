import { useState } from 'react';

const HospitalComponent = () => {
    const [proof, setProof] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null); // To track success/error for modal styling

    const [formData, setFormData] = useState({
        hospitalId: '',
        name: '',
        location: '',
        treatment: '',
        contactNumber: '',
        adminName: '',
        capacity: '',
    });
    console.log('Form data:', formData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateHospital = async () => {
        setIsModalOpen(false); // Close previous modal if open
        try {
            const response = await fetch('http://localhost:4001/hospitals/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            let result;
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
                setModalMessage('Hospital created successfully!');
                // Optionally clear form:
                // setFormData({ hospitalId: '', name: '', location: '', treatment: '', contactNumber: '', adminName: '', capacity: '' });
            } else {
                setIsSuccess(false);
                console.error("Backend error response details:", result);
                setModalMessage(result?.message || `Failed to create hospital (Status: ${response.status})`);
            }
            setIsModalOpen(true);
        } catch (error) {
            console.error('Hospital creation fetch/network error:', error);
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
                    <h1 className="card-title text-2xl font-bold">ZK-SNARK Example</h1>
                    <p className="mb-4">Generate Hospital Record.</p>

                    <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">ID</span>
                                </label>
                                <input type="text"
                                    name="hospitalId"
                                    value={formData.hospitalId}
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
                                    placeholder="Enter hospital name" />
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
                                    <span className="label-text font-medium">Capacity</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="capacity"
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter capacity of unit" />
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
                                    <span className="label-text font-medium">Admin Name</span>
                                </label>
                                <input type="text" 
                                    className="input input-bordered w-full" 
                                    name="adminName"
                                    value={formData.adminName}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    placeholder="Enter admin name" />
                            </div>
                        </div>
                        <select className="select select-bordered w-full"
                                name="treatment"
                                value={formData.treatment}
                                onChange={handleChange}
                                required>
                                <option disabled value="">Select Treatment</option>
                                <option>Injury</option>
                                <option>Check up</option>
                                <option>Burn</option>
                                <option>Fracture</option>
                                <option>Dietary</option>
                            </select>
                    </form>

                    <div className="flex gap-2 mb-4 mt-4">
                        <button className="btn btn-primary" onClick={generateHospital}>Create Hospital</button>
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

export default HospitalComponent;