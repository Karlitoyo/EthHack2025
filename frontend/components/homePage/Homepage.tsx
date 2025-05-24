import { useState } from 'react';
import { Button } from '../ui/button';
import { PageLoader } from '../ui/page-loader';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Span } from '../ui/span';
import { FieldSet } from '../ui/field-set';
import { Lengend } from '../ui/legend';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Card } from '../ui/card';
import { CardHeader } from '../ui/card-header';
import { CardTitle } from '../ui/card-title';
import { CardDescription } from '../ui/card-description';
import { CardContent } from '../ui/card-content';
import { CardFooter } from '../ui/card-footer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Divider } from '../ui/divider';

const ZKComponent = () => {
    const [proof, setProof] = useState(null);
    const [isValid, setIsValid] = useState(null);

    const generateProof = async () => {
        try {
            const response = await fetch('http://localhost:4001/zk-snark/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: 42 }),
            });
            const result = await response.json();
            setProof(result);
        } catch (error) {
            console.error('Proof generation error:', error);
        }
    };

    const verifyProof = async () => {
        console.log("Payload sent to Rust verify-proof:", JSON.stringify(proof, null, 2));
        if (!proof) return alert('Generate proof first');
        try {
            const response = await fetch('http://localhost:4001/zk-snark/verify-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(proof),
            });
            const result = await response.json();
            console.log('Proof sent:', JSON.stringify(proof));
            console.log('Public Input sent:', JSON.stringify(proof.public_input));
            setIsValid(result);
        } catch (error) {
            console.error('Proof verification error:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
            <div className="card-body">
                <h1 className="card-title text-2xl font-bold">ZK-SNARK Example</h1>
                <p className="mb-4">Generate and verify a zero-knowledge proof.</p>
                <div className="flex gap-2 mb-4">
                    <Button onClick={generateProof}>Generate Proof</Button>
                    <Button variant='accent' onClick={verifyProof}>Verify Proof</Button>
                </div>
                {proof && (
                <div className="collapse collapse-arrow bg-base-200 mb-4">
                    <input type="checkbox" /> 
                    <div className="collapse-title font-medium">
                    Proof Generated
                    </div>
                    <div className="collapse-content">
                    <pre className="text-xs whitespace-pre-wrap break-all bg-base-300 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(proof, null, 2)}
                    </pre>
                    </div>
                </div>
                )}
                
                {isValid !== null && (
                <div className={`alert ${isValid ? 'alert-success' : 'alert-error'}`}>
                    <div>
                    {isValid ? 
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> :
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    }
                    <span>{isValid ? 'Valid' : 'Invalid'} proof</span>
                    </div>
                </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default ZKComponent;