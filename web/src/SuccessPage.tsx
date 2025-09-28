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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
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
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white', maxWidth: '500px', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2>Oops! Something went wrong</h2>
          <p style={{ fontSize: '18px', marginBottom: '30px' }}>{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              background: 'white',
              color: '#ff6b6b',
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        background: 'white', 
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        {/* Success Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
          <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>Letter Sent Successfully!</h1>
          <p style={{ color: '#7f8c8d', fontSize: '18px' }}>
            Your letter has been processed and will be delivered within 3-5 business days.
          </p>
        </div>

        {/* Confirmation Details */}
        {jobData && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ color: '#2c3e50', marginBottom: '20px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
              Confirmation Details
            </h2>
            
            <div style={{ display: 'grid', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>Tracking Information</h3>
                {jobData.tracking.provider === 'lob' && jobData.tracking.code ? (
                  <p><strong>Tracking Code:</strong> 
                    <code style={{ background: '#e9ecef', padding: '4px 8px', borderRadius: '4px' }}>
                      {jobData.tracking.code}
                    </code>
                  </p>
                ) : (
                  <p><strong>Status:</strong> <span style={{ color: '#f39c12' }}>Processing your letter...</span></p>
                )}
                <p><strong>Status:</strong> 
                  <span style={{ 
                    color: jobData.status === 'completed' ? '#27ae60' : 
                           jobData.status === 'failed' ? '#e74c3c' : 
                           jobData.status === 'processing' ? '#f39c12' : '#3498db',
                    fontWeight: 'bold' 
                  }}>
                    {jobData.status.toUpperCase()}
                    {jobData.status === 'submitted' && ' - Processing your letter...'}
                    {jobData.status === 'processing' && ' - Sending via Lob API...'}
                  </span>
                </p>
                <p><strong>Order Date:</strong> {new Date(jobData.createdAt).toLocaleDateString()}</p>
              </div>

              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>From</h3>
                <p><strong>{jobData.sender.name}</strong></p>
                <p>{jobData.sender.address_line1}</p>
                <p>{jobData.sender.address_city}, {jobData.sender.address_state}</p>
              </div>

              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>To</h3>
                <p><strong>{jobData.recipient.name}</strong></p>
                <p>{jobData.recipient.address_line1}</p>
                <p>{jobData.recipient.address_city}, {jobData.recipient.address_state}</p>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div style={{ background: '#e8f5e8', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <h3 style={{ color: '#27ae60', marginBottom: '15px' }}>What happens next?</h3>
          <ul style={{ color: '#2c3e50', lineHeight: '1.6' }}>
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
              background: '#3498db',
              color: 'white',
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
              background: '#95a5a6',
              color: 'white',
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
