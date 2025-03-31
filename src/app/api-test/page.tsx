'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthToken } from '@/lib/auth';

// Define the appropriate types
interface MowerInfo {
  id: string;
  name: string;
  status?: string;
  batteryLevel?: number;
}

interface TestResult {
  getTest: {
    status: number;
    data: any;
  };
  postTest: {
    status: number;
    data: any;
  };
}

export default function APITestPage() {
  const [mowerId, setMowerId] = useState('');
  const [command, setCommand] = useState('start');
  const [duration, setDuration] = useState('60');
  const [results, setResults] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Get a list of mowers to choose from
  const [mowers, setMowers] = useState<MowerInfo[]>([]);
  const [loadingMowers, setLoadingMowers] = useState(false);

  useEffect(() => {
    const fetchMowers = async () => {
      setLoadingMowers(true);
      try {
        const token = getAuthToken();
        if (!token) {
          setError('No auth token found. Please connect your Husqvarna account.');
          return;
        }

        const response = await fetch('/api/mowers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch mowers');
        }

        const data = await response.json();
        setMowers(data.mowers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoadingMowers(false);
      }
    };

    fetchMowers();
  }, []);

  const testEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = getAuthToken();
      if (!token) {
        setError('No auth token found. Please connect your Husqvarna account.');
        return;
      }

      // Test the GET endpoint first
      const getResponse = await fetch(`/api/mowers/${mowerId}/actions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const getData = await getResponse.json();
      
      // Now test the POST endpoint
      const response = await fetch(`/api/mowers/${mowerId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          command,
          duration: Number.parseInt(duration, 10)
        })
      });

      const data = await response.json();
      
      setResults({
        getTest: {
          status: getResponse.status,
          data: getData
        },
        postTest: {
          status: response.status,
          data
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">API Endpoint Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available Mowers</CardTitle>
          <CardDescription>Select a mower to test the API with</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMowers ? (
            <p>Loading mowers...</p>
          ) : mowers.length > 0 ? (
            <div className="space-y-2">
              {mowers.map((mower) => (
                <div key={mower.id} className="flex items-center justify-between border p-3 rounded">
                  <div>
                    <p className="font-medium">{mower.name}</p>
                    <p className="text-sm text-gray-500">{mower.id}</p>
                  </div>
                  <Button onClick={() => setMowerId(mower.id)}>Select</Button>
                </div>
              ))}
            </div>
          ) : (
            <p>No mowers found</p>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Mower API Endpoint</CardTitle>
          <CardDescription>Send commands to your mower</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="mowerId" className="block text-sm font-medium mb-1">Mower ID</label>
              <Input
                id="mowerId"
                value={mowerId}
                onChange={(e) => setMowerId(e.target.value)}
                placeholder="Enter mower ID"
                className="w-full"
              />
            </div>
            
            <div>
              <label htmlFor="command" className="block text-sm font-medium mb-1">Command</label>
              <select
                id="command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="start">Start</option>
                <option value="pause">Pause</option>
                <option value="park">Park</option>
                <option value="parkUntilNext">Park Until Next Schedule</option>
                <option value="resumeSchedule">Resume Schedule</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="duration" className="block text-sm font-medium mb-1">Duration (minutes)</label>
              <Input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Enter duration in minutes"
                type="number"
                className="w-full"
              />
            </div>
            
            <Button 
              onClick={testEndpoint}
              disabled={loading || !mowerId}
              className="w-full"
            >
              {loading ? 'Testing...' : 'Test API Endpoint'}
            </Button>
            
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded text-red-800">
                <p className="font-bold">Error:</p>
                <p>{error}</p>
              </div>
            )}
            
            {results && (
              <div className="mt-4">
                <h3 className="font-bold text-lg mb-2">Results:</h3>
                <div className="p-3 bg-gray-100 rounded">
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 