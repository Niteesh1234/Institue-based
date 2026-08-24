import { deploymentMetadata } from '../vercel-catalog.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  return response.status(200).json({ service: 'vijetha-testing-api', database: deploymentMetadata.databaseName, moduleVersion: deploymentMetadata.moduleVersion, status: deploymentMetadata.hasMongo ? 'configured' : 'preview' });
}
