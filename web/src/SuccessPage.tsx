import React, { useState, useEffect } from 'react';

interface SuccessPageProps {
  sessionId?: string;
}

interface JobData {
  id: string;
  status: string;
  tracking: {
    code: string;
    provider: string;
  };
  sender: {
    name: string;
    address_line1: string;
    address_city: string;
    address_state: string;
  };
  recipient: {
    name: string;
    address_line1: string;
    address_city: string;
    address_state: string;
  };
  createdAt: string;
}

const SuccessPage: React.FC<SuccessPageProps> = ({ sessionId }) => {
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchJobData(sessionId);
    }
  }, [sessionId]);

  const fetchJobData = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/jobs/by-session/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setJobData(data);
        
        // If job is still submitted/processing, start polling for updates
        if (data.status === 'submitted' || data.status === 'processing') {
          startPolling(sessionId);
        }
      } else {
        setError('Job not found. Please contact support.');
      }
    } catch (err) {
      setError('Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/by-session/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setJobData(data);
          
          // Stop polling when job is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    // Clean up polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111827'
      }}>
        <div style={{ textAlign: 'center', color: '#e5e7eb' }}>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>⏳</div>
          <h2>Loading your confirmation...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111827'
      }}>
        <div style={{ textAlign: 'center', color: '#e5e7eb', maxWidth: '500px', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2>Oops! Something went wrong</h2>
          <p style={{ fontSize: '18px', marginBottom: '30px' }}>{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              background: '#1f2937',
              color: '#e5e7eb',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#111827',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        background: '#0f172a', 
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Dynamic Header based on status */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {jobData.status === 'completed' ? (
            <>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
              <h1 style={{ color: '#e5e7eb', marginBottom: '10px' }}>Letter Sent Successfully!</h1>
              <p style={{ color: '#cbd5e1', fontSize: '18px' }}>
                Your letter has been processed and will be delivered within 3-5 business days.
              </p>
            </>
          ) : jobData.status === 'failed' ? (
            <>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>❌</div>
              <h1 style={{ color: '#fca5a5', marginBottom: '10px' }}>Letter Processing Failed</h1>
              <p style={{ color: '#cbd5e1', fontSize: '18px' }}>
                We encountered an issue processing your letter. Please contact support for assistance.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
              <h1 style={{ color: '#fde68a', marginBottom: '10px' }}>Processing Your Letter</h1>
              <p style={{ color: '#cbd5e1', fontSize: '18px' }}>
                Your letter is being processed. You'll receive updates as it progresses.
              </p>
            </>
          )}
        </div>

        {/* Confirmation Details */}
        {jobData && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ color: '#e5e7eb', marginBottom: '20px', borderBottom: '2px solid #60a5fa', paddingBottom: '10px' }}>
              Confirmation Details
            </h2>
            
            <div style={{ display: 'grid', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#e5e7eb', marginBottom: '10px' }}>Tracking Information</h3>
                {jobData.tracking.provider === 'lob' && jobData.tracking.code ? (
                  <p><strong>Tracking Code:</strong> 
                    <code style={{ background: '#0b1220', padding: '4px 8px', borderRadius: '4px', color: '#e5e7eb' }}>
                      {jobData.tracking.code}
                    </code>
                  </p>
                ) : (
                  <p><strong>Status:</strong> <span style={{ color: '#fde68a' }}>Processing your letter...</span></p>
                )}
                <p><strong>Status:</strong> 
                  <span style={{ 
                    color: jobData.status === 'completed' ? '#34d399' : 
                           jobData.status === 'failed' ? '#fca5a5' : 
                           jobData.status === 'processing' ? '#fde68a' : '#93c5fd',
                    fontWeight: 'bold' 
                  }}>
                    {jobData.status.toUpperCase()}
                    {jobData.status === 'submitted' && ' - Processing your letter...'}
                    {jobData.status === 'processing' && ' - Sending via Lob API...'}
                  </span>
                </p>
                <p><strong>Order Date:</strong> {new Date(jobData.createdAt).toLocaleDateString()}</p>
              </div>

              <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#e5e7eb', marginBottom: '10px' }}>From</h3>
                <p><strong>{jobData.sender.name}</strong></p>
                <p>{jobData.sender.address_line1}</p>
                <p>{jobData.sender.address_city}, {jobData.sender.address_state}</p>
              </div>

              <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#e5e7eb', marginBottom: '10px' }}>To</h3>
                <p><strong>{jobData.recipient.name}</strong></p>
                <p>{jobData.recipient.address_line1}</p>
                <p>{jobData.recipient.address_city}, {jobData.recipient.address_state}</p>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div style={{ background: '#0b1220', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <h3 style={{ color: '#a7f3d0', marginBottom: '15px' }}>What happens next?</h3>
          <ul style={{ color: '#e5e7eb', lineHeight: '1.6' }}>
            <li>Your letter will be printed and prepared for mailing within 24 hours</li>
            <li>It will be sent via USPS First Class Mail</li>
            <li>You'll receive email updates when the letter is processed and mailed</li>
            <li>Delivery typically takes 3-5 business days</li>
          </ul>
        </div>

        {/* Actions */}
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              background: '#1d4ed8',
              color: '#e5e7eb',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Send Another Letter
          </button>
          <button 
            onClick={() => window.print()}
            style={{
              background: '#6b7280',
              color: '#e5e7eb',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;
