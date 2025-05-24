import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return res.status(400).json({ message: 'Identifier is required' });
      }

      // Construct the URL for the backend service
      // Ensure your backend service is running and accessible
      // You might need to use an environment variable for the backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001'; // Use NEXT_PUBLIC_BACKEND_URL
      
      const proofResponse = await fetch(`${backendUrl}/zk-snark/generate-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier }),
      });

      if (!proofResponse.ok) {
        const errorText = await proofResponse.text();
        console.error('Backend error:', errorText);
        return res.status(proofResponse.status).json({ message: `Error from backend: ${errorText}` });
      }

      const proofData = await proofResponse.json();
      return res.status(200).json(proofData);

    } catch (error: any) {
      console.error('API route error:', error);
      return res.status(500).json({ message: error.message || 'Internal server error' });
    }
  } else {
    // Handle any other HTTP method
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
