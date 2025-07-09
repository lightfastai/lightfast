'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster, toast } from 'sonner';
import { nanoid } from 'nanoid';

export default function TaskExecutorPage() {
  const [taskDescription, setTaskDescription] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [chatId] = useState(() => nanoid());

  const handleExecute = async () => {
    if (!taskDescription.trim()) {
      toast.error('Please enter a task description');
      return;
    }

    setIsExecuting(true);
    
    try {
      const response = await fetch('/api/task/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskDescription,
          chatId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute task');
      }

      const result = await response.json();
      toast.success(`Task execution started: ${result.eventId}`);
      
      // Open SSE connection to receive updates
      const eventSource = new EventSource(`/api/sse?chatId=${chatId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE Update:', data);
        toast.info(data.message);
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setIsExecuting(false);
      };
      
    } catch (error) {
      console.error('Error executing task:', error);
      toast.error('Failed to execute task');
      setIsExecuting(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Universal Task Executor</CardTitle>
          <CardDescription>
            Describe any computational task and let the AI system analyze, plan, and execute it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="task" className="block text-sm font-medium mb-2">
              Task Description
            </label>
            <Textarea
              id="task"
              placeholder="Example: Calculate the fibonacci sequence up to the 20th number and create a visualization chart"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="min-h-[150px]"
              disabled={isExecuting}
            />
          </div>
          
          <Button 
            onClick={handleExecute} 
            disabled={isExecuting || !taskDescription.trim()}
            className="w-full"
          >
            {isExecuting ? 'Executing...' : 'Execute Task'}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <p>Examples of tasks you can run:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Generate a random password with specific requirements</li>
              <li>Calculate prime numbers up to 1000</li>
              <li>Convert CSV data to JSON format</li>
              <li>Create a simple data visualization</li>
              <li>Parse and analyze log files</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}