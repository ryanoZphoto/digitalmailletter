import React from 'react'
import SuccessPage from './SuccessPage'

export default function App() {
  // Check if we're on success page
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const success = urlParams.get('success');
  
  if (success === '1' && sessionId) {
    return <SuccessPage sessionId={sessionId} />;
  }
  // Sender fields
  const [senderName, setSenderName] = React.useState('');
  const [senderLine1, setSenderLine1] = React.useState('');
  const [senderLine2, setSenderLine2] = React.useState('');
  const [senderCity, setSenderCity] = React.useState('');
  const [senderState, setSenderState] = React.useState('');
  const [senderZip, setSenderZip] = React.useState('');
  const [senderCountry, setSenderCountry] = React.useState('US');

  // Recipient fields
  const [recipientName, setRecipientName] = React.useState('');
  const [recipientLine1, setRecipientLine1] = React.useState('');
  const [recipientLine2, setRecipientLine2] = React.useState('');
  const [recipientCity, setRecipientCity] = React.useState('');
  const [recipientState, setRecipientState] = React.useState('');
  const [recipientZip, setRecipientZip] = React.useState('');
  const [recipientCountry, setRecipientCountry] = React.useState('US');

  const [templateId, setTemplateId] = React.useState('tpl-default');
  const [messageContent, setMessageContent] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [result, setResult] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewTemplate, setPreviewTemplate] = React.useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setResult('');
    
    // Validate email
    if (!customerEmail || !customerEmail.includes('@')) {
      setResult('error: Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }
    try {
      const sender = {
        name: senderName,
        address_line1: senderLine1,
        address_line2: senderLine2,
        address_city: senderCity,
        address_state: senderState,
        address_zip: senderZip,
        address_country: senderCountry
      };

      const recipient = {
        name: recipientName,
        address_line1: recipientLine1,
        address_line2: recipientLine2,
        address_city: recipientCity,
        address_state: recipientState,
        address_zip: recipientZip,
        address_country: recipientCountry
      };

      // Prepare the body content with proper HTML formatting
      const bodyContent = messageContent.replace(/\n/g, '<br />');
      
      const payload = { sender, recipient, templateId, serviceLevel: 'first_class', body: bodyContent, subject: subject || undefined, customerEmail };
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setResult('error:' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoData() {
    setSenderName('Alice Johnson');
    setSenderLine1('123 Main Street');
    setSenderLine2('Suite 4B');
    setSenderCity('San Francisco');
    setSenderState('CA');
    setSenderZip('94102');
    setRecipientName('Bob Smith');
    setRecipientLine1('456 Market Street');
    setRecipientLine2('');
    setRecipientCity('New York');
    setRecipientState('NY');
    setRecipientZip('10001');
    setSubject('Following up on our meeting');
    setMessageContent(`I hope this letter finds you well. I wanted to follow up on our productive meeting last week and share some additional thoughts.

As discussed, I believe there are excellent opportunities for our organizations to collaborate on the upcoming project. The timeline and budget we outlined seem very reasonable, and I'm excited about the potential outcomes.

I've attached the preliminary proposal for your review. Please let me know if you have any questions or would like to schedule another meeting to discuss the details further.

Thank you for your time and consideration. I look forward to hearing from you soon.`);
  }

  function openPreview(template: string) {
    setPreviewTemplate(template);
    setShowPreview(true);
  }

  function closePreview() {
    setShowPreview(false);
    setPreviewTemplate('');
  }

  const templates = [
    {
      id: 'tpl-default',
      name: '📝 Standard Business Letter',
      description: 'Professional letterhead with clean formatting. Perfect for business correspondence, proposals, and general communications.',
      features: ['Professional header', 'Clean layout', 'Business-appropriate styling']
    },
    {
      id: 'tpl-formal',
      name: '👔 Formal Letter (Legal/Official)',
      description: 'Traditional formal letter format with official styling. Ideal for legal notices, official correspondence, and government communications.',
      features: ['Official letterhead', 'Formal language structure', 'Legal document styling', 'Signature lines']
    },
    {
      id: 'tpl-personal',
      name: '💌 Personal Letter',
      description: 'Warm, friendly design perfect for personal correspondence. Great for thank you notes, personal invitations, and friendly communications.',
      features: ['Warm color scheme', 'Casual formatting', 'Personal touch design']
    },
    {
      id: 'tpl-invoice',
      name: '🧾 Invoice/Bill',
      description: 'Professional invoice template with itemized billing structure. Perfect for freelancers, small businesses, and service providers.',
      features: ['Itemized billing table', 'Professional invoice header', 'Payment terms section', 'Total calculations']
    }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#333'
    }}>
      {/* Header */}
      <div style={{ 
        background: 'rgba(255,255,255,0.95)', 
        padding: '20px 0',
        borderBottom: '1px solid #e1e5e9',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block'
          }}>
            📮 Mail My Forms
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: '18px', 
            color: '#666',
            fontWeight: '400'
          }}>
            Professional Letter Printing & Mailing Service
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        padding: '40px 20px',
        textAlign: 'center' as const
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '32px',
            margin: '0 0 15px 0',
            fontWeight: '700',
            color: '#2d3748'
          }}>
            Send Physical Letters with Ease
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#4a5568',
            margin: '0 0 25px 0',
            lineHeight: '1.5'
          }}>
            We print, stamp, and mail your letters for you. Perfect for businesses, legal notices,
            personal correspondence, and any situation where a physical letter is required.
          </p>

          {/* Features - Horizontal Layout */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '10px',
            margin: '20px 0',
            padding: '15px',
            background: '#f8fafc',
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' as const, minWidth: '120px', flex: '1' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>🖨️</div>
              <h3 style={{ fontSize: '12px', margin: '0 0 2px 0', fontWeight: '600' }}>Professional Printing</h3>
              <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>High-quality letterhead</p>
            </div>
            <div style={{ textAlign: 'center' as const, minWidth: '120px', flex: '1' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>📬</div>
              <h3 style={{ fontSize: '12px', margin: '0 0 2px 0', fontWeight: '600' }}>Real Mail Delivery</h3>
              <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>USPS handling</p>
            </div>
            <div style={{ textAlign: 'center' as const, minWidth: '120px', flex: '1' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>📊</div>
              <h3 style={{ fontSize: '12px', margin: '0 0 2px 0', fontWeight: '600' }}>Tracking & Status</h3>
              <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Full visibility</p>
            </div>
            <div style={{ textAlign: 'center' as const, minWidth: '120px', flex: '1' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>⚡</div>
              <h3 style={{ fontSize: '12px', margin: '0 0 2px 0', fontWeight: '600' }}>Fast Turnaround</h3>
              <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Same-day processing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div style={{
        background: '#f8fafc',
        padding: '5px 20px 20px 20px',
        marginTop: '-10px'
      }}>
        <div style={{ width: '100%', margin: '0' }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            width: '100%',
            marginTop: '5px'
          }}>
            <div style={{ textAlign: 'center' as const, marginBottom: '15px' }}>
              <h2 style={{
                fontSize: '20px',
                margin: '0 0 6px 0',
                fontWeight: '600',
                color: '#2d3748'
              }}>
                Send Your Letter
              </h2>
              <p style={{
                fontSize: '12px',
                color: '#666',
                margin: '0 0 10px 0'
              }}>
                Fill out the form below to send a professional letter. We'll print and mail it for you.
              </p>
              <button
                onClick={fillDemoData}
                style={{
                  background: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📝 Fill Demo Data
              </button>
            </div>

            <form onSubmit={submit}>
              {/* Main Layout - Template Left, Forms Right */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '25px',
                marginBottom: '20px'
              }}>
                {/* Template Section - Left Side */}
                <div style={{ 
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#fafafa',
                  height: 'fit-content'
                }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1a365d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📄 Choose Template
                  </h3>
                  
                  <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px 0' }}>
                    Select a template and preview how your letter will look.
                  </p>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {templates.map(template => (
                      <div 
                        key={template.id}
                        style={{ 
                          border: templateId === template.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          padding: '12px',
                          background: templateId === template.id ? '#eff6ff' : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '14px'
                        }}
                        onClick={() => setTemplateId(template.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <input 
                                type="radio" 
                                name="template" 
                                value={template.id}
                                checked={templateId === template.id}
                                onChange={() => setTemplateId(template.id)}
                                style={{ margin: 0 }}
                              />
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2d3748' }}>
                                {template.name}
                              </h4>
                            </div>
                            
                            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 12px 0' }}>
                              {template.description}
                            </p>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {template.features.map((feature, index) => (
                                <span 
                                  key={index}
                                  style={{ 
                                    fontSize: '12px', 
                                    background: '#e2e8f0', 
                                    color: '#4a5568',
                                    padding: '2px 8px', 
                                    borderRadius: '4px' 
                                  }}
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview(template.id);
                            }}
                            style={{ 
                              background: '#3498db', 
                              color: 'white', 
                              border: 'none', 
                              padding: '6px 12px', 
                              borderRadius: '4px', 
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            👁️ Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Address Sections - Right Side, Stacked */}
                <div style={{ 
                  display: 'grid', 
                  gap: '15px'
                }}>
                {/* Sender Section */}
                <div style={{ 
                  padding: '18px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white'
                }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1a365d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📤 Sender Information
                  </h3>
                  
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {/* Name - Full Width */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                        Full Name *
                      </label>
                      <input 
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '4px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        value={senderName} 
                        onChange={e => setSenderName(e.target.value)} 
                        placeholder="John Smith"
                        required 
                      />
                    </div>
                    
                    {/* Address Lines - Side by Side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Address Line 1 *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={senderLine1} 
                          onChange={e => setSenderLine1(e.target.value)} 
                          placeholder="123 Main Street"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Line 2
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={senderLine2} 
                          onChange={e => setSenderLine2(e.target.value)} 
                          placeholder="Apt 4B"
                        />
                      </div>
                    </div>
                    
                    {/* City, State, ZIP, Country - All in One Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          City *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={senderCity} 
                          onChange={e => setSenderCity(e.target.value)} 
                          placeholder="San Francisco"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          State *
                        </label>
                        <select 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none',
                            background: 'white'
                          }}
                          value={senderState} 
                          onChange={e => setSenderState(e.target.value)} 
                          required
                        >
                          <option value="">Select State</option>
                          <option value="AL">Alabama</option>
                          <option value="AK">Alaska</option>
                          <option value="AZ">Arizona</option>
                          <option value="AR">Arkansas</option>
                          <option value="CA">California</option>
                          <option value="CO">Colorado</option>
                          <option value="CT">Connecticut</option>
                          <option value="DE">Delaware</option>
                          <option value="FL">Florida</option>
                          <option value="GA">Georgia</option>
                          <option value="HI">Hawaii</option>
                          <option value="ID">Idaho</option>
                          <option value="IL">Illinois</option>
                          <option value="IN">Indiana</option>
                          <option value="IA">Iowa</option>
                          <option value="KS">Kansas</option>
                          <option value="KY">Kentucky</option>
                          <option value="LA">Louisiana</option>
                          <option value="ME">Maine</option>
                          <option value="MD">Maryland</option>
                          <option value="MA">Massachusetts</option>
                          <option value="MI">Michigan</option>
                          <option value="MN">Minnesota</option>
                          <option value="MS">Mississippi</option>
                          <option value="MO">Missouri</option>
                          <option value="MT">Montana</option>
                          <option value="NE">Nebraska</option>
                          <option value="NV">Nevada</option>
                          <option value="NH">New Hampshire</option>
                          <option value="NJ">New Jersey</option>
                          <option value="NM">New Mexico</option>
                          <option value="NY">New York</option>
                          <option value="NC">North Carolina</option>
                          <option value="ND">North Dakota</option>
                          <option value="OH">Ohio</option>
                          <option value="OK">Oklahoma</option>
                          <option value="OR">Oregon</option>
                          <option value="PA">Pennsylvania</option>
                          <option value="RI">Rhode Island</option>
                          <option value="SC">South Carolina</option>
                          <option value="SD">South Dakota</option>
                          <option value="TN">Tennessee</option>
                          <option value="TX">Texas</option>
                          <option value="UT">Utah</option>
                          <option value="VT">Vermont</option>
                          <option value="VA">Virginia</option>
                          <option value="WA">Washington</option>
                          <option value="WV">West Virginia</option>
                          <option value="WI">Wisconsin</option>
                          <option value="WY">Wyoming</option>
                          <option value="DC">District of Columbia</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          ZIP *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={senderZip} 
                          onChange={e => setSenderZip(e.target.value)} 
                          placeholder="94102"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Country *
                        </label>
                        <select 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none',
                            background: 'white'
                          }}
                          value={senderCountry} 
                          onChange={e => setSenderCountry(e.target.value)} 
                          required
                        >
                          <option value="US">🇺🇸 US</option>
                          <option value="CA">🇨🇦 CA</option>
                          <option value="GB">🇬🇧 GB</option>
                          <option value="AU">🇦🇺 AU</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipient Section */}
                <div style={{ 
                  padding: '18px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white'
                }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1a365d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📥 Recipient Information
                  </h3>
                  
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {/* Name - Full Width */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                        Full Name *
                      </label>
                      <input 
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '4px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        value={recipientName} 
                        onChange={e => setRecipientName(e.target.value)} 
                        placeholder="Jane Doe"
                        required 
                      />
                    </div>
                    
                    {/* Address Lines - Side by Side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Address Line 1 *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={recipientLine1} 
                          onChange={e => setRecipientLine1(e.target.value)} 
                          placeholder="456 Oak Avenue"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Line 2
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={recipientLine2} 
                          onChange={e => setRecipientLine2(e.target.value)} 
                          placeholder="Unit 205"
                        />
                      </div>
                    </div>
                    
                    {/* City, State, ZIP, Country - All in One Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          City *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={recipientCity} 
                          onChange={e => setRecipientCity(e.target.value)} 
                          placeholder="New York"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          State *
                        </label>
                        <select 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none',
                            background: 'white'
                          }}
                          value={recipientState} 
                          onChange={e => setRecipientState(e.target.value)} 
                          required
                        >
                          <option value="">Select State</option>
                          <option value="AL">Alabama</option>
                          <option value="AK">Alaska</option>
                          <option value="AZ">Arizona</option>
                          <option value="AR">Arkansas</option>
                          <option value="CA">California</option>
                          <option value="CO">Colorado</option>
                          <option value="CT">Connecticut</option>
                          <option value="DE">Delaware</option>
                          <option value="FL">Florida</option>
                          <option value="GA">Georgia</option>
                          <option value="HI">Hawaii</option>
                          <option value="ID">Idaho</option>
                          <option value="IL">Illinois</option>
                          <option value="IN">Indiana</option>
                          <option value="IA">Iowa</option>
                          <option value="KS">Kansas</option>
                          <option value="KY">Kentucky</option>
                          <option value="LA">Louisiana</option>
                          <option value="ME">Maine</option>
                          <option value="MD">Maryland</option>
                          <option value="MA">Massachusetts</option>
                          <option value="MI">Michigan</option>
                          <option value="MN">Minnesota</option>
                          <option value="MS">Mississippi</option>
                          <option value="MO">Missouri</option>
                          <option value="MT">Montana</option>
                          <option value="NE">Nebraska</option>
                          <option value="NV">Nevada</option>
                          <option value="NH">New Hampshire</option>
                          <option value="NJ">New Jersey</option>
                          <option value="NM">New Mexico</option>
                          <option value="NY">New York</option>
                          <option value="NC">North Carolina</option>
                          <option value="ND">North Dakota</option>
                          <option value="OH">Ohio</option>
                          <option value="OK">Oklahoma</option>
                          <option value="OR">Oregon</option>
                          <option value="PA">Pennsylvania</option>
                          <option value="RI">Rhode Island</option>
                          <option value="SC">South Carolina</option>
                          <option value="SD">South Dakota</option>
                          <option value="TN">Tennessee</option>
                          <option value="TX">Texas</option>
                          <option value="UT">Utah</option>
                          <option value="VT">Vermont</option>
                          <option value="VA">Virginia</option>
                          <option value="WA">Washington</option>
                          <option value="WV">West Virginia</option>
                          <option value="WI">Wisconsin</option>
                          <option value="WY">Wyoming</option>
                          <option value="DC">District of Columbia</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          ZIP *
                        </label>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          value={recipientZip} 
                          onChange={e => setRecipientZip(e.target.value)} 
                          placeholder="10001"
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                          Country *
                        </label>
                        <select 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none',
                            background: 'white'
                          }}
                          value={recipientCountry} 
                          onChange={e => setRecipientCountry(e.target.value)} 
                          required
                        >
                          <option value="US">🇺🇸 US</option>
                          <option value="CA">🇨🇦 CA</option>
                          <option value="GB">🇬🇧 GB</option>
                          <option value="AU">🇦🇺 AU</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              {/* Customer Email Section */}
              <div style={{ 
                marginBottom: '25px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#f0f9ff'
              }}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1a365d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  📧 Contact Information
                </h3>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                    Your Email Address *
                  </label>
                  <input 
                    type="email" 
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                    We'll send you a confirmation and tracking information
                  </p>
                </div>
              </div>

              {/* Message Content Section - Compact */}
              <div style={{ 
                marginBottom: '25px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white'
              }}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1a365d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  ✍️ Your Message
                </h3>
                
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                      Subject (Optional)
                    </label>
                    <input 
                      style={{ 
                        width: '100%', 
                        padding: '8px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      value={subject} 
                      onChange={e => setSubject(e.target.value)} 
                      placeholder="Letter subject or reference"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#374151', fontSize: '13px' }}>
                      Message Content *
                    </label>
                    <textarea 
                      style={{ 
                        width: '100%', 
                        minHeight: '120px',
                        padding: '8px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '4px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                      value={messageContent} 
                      onChange={e => setMessageContent(e.target.value)} 
                      placeholder="Write your letter content here..."
                      required 
                    />
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#666', 
                      margin: '3px 0 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>💡 Use template preview to see formatting</span>
                      <span>{messageContent.length} chars</span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Submit Button */}
              <div style={{ textAlign: 'center' as const }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '16px 32px', 
                    borderRadius: '12px', 
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)'
                  }}
                >
                  {isSubmitting ? '⏳ Processing...' : '📮 Send Letter ($2.50)'}
                </button>
                <p style={{ fontSize: '14px', color: '#666', margin: '12px 0 0 0' }}>
                  Includes printing, postage, and first-class delivery
                </p>
        </div>
      </form>

            {/* Result Display */}
            {result && (
              <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                backgroundColor: result.startsWith('success:') ? '#f0fdf4' : '#fef2f2', 
                border: `2px solid ${result.startsWith('success:') ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: '12px'
              }}>
                {result.startsWith('success:') ? (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>✅</div>
                    <h3 style={{ margin: '0 0 12px 0', color: '#065f46', fontSize: '20px', fontWeight: '600' }}>
                      Letter Submitted Successfully!
                    </h3>
                    <div style={{ color: '#047857', fontSize: '16px' }}>
                      <p style={{ margin: '8px 0' }}>
                        <strong>Job ID:</strong> {result.split('|')[0].replace('success:Job ID: ', '')}
                      </p>
                      <p style={{ margin: '8px 0' }}>
                        <strong>Tracking Code:</strong> {result.split('|')[1]?.replace('Tracking: ', '')}
                      </p>
                    </div>
                    <p style={{ fontSize: '14px', color: '#065f46', margin: '16px 0 0 0' }}>
                      📬 Your letter will be printed and mailed within 1 business day. 
                      You'll receive email updates on the delivery status.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>❌</div>
                    <h3 style={{ margin: '0 0 12px 0', color: '#dc2626', fontSize: '20px', fontWeight: '600' }}>
                      Submission Failed
                    </h3>
                    <p style={{ color: '#b91c1c', fontSize: '16px', margin: '8px 0' }}>
                      {result.replace('error:', '')}
                    </p>
                    <p style={{ fontSize: '14px', color: '#dc2626', margin: '16px 0 0 0' }}>
                      Please check your information and try again. If the problem persists, contact support.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        background: '#2d3748', 
        color: 'white', 
        padding: '40px 20px',
        textAlign: 'center' as const
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: '600' }}>
            Need Help?
          </h3>
          <p style={{ fontSize: '16px', color: '#a0aec0', margin: '0 0 20px 0' }}>
            Our mail processing service handles everything from printing to delivery. 
            Perfect for businesses, legal professionals, and anyone who needs reliable mail service.
          </p>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '20px',
            margin: '30px 0'
          }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>📞 Support</h4>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: '14px' }}>1-800-MAIL-NOW</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>📧 Email</h4>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: '14px' }}>support@mailmyforms.com</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>⏰ Hours</h4>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: '14px' }}>Mon-Fri 9AM-6PM EST</p>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#718096', margin: '30px 0 0 0' }}>
            © 2025 Mail My Forms. Professional letter printing and mailing service.
          </p>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                Template Preview: {templates.find(t => t.id === previewTemplate)?.name}
              </h3>
              <button 
                onClick={closePreview}
                style={{
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{
              flex: 1,
              padding: '20px',
              overflow: 'auto'
            }}>
              <div style={{
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '20px',
                background: '#f9fafb',
                textAlign: 'center' as const,
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <iframe 
                  srcDoc={undefined}
                  ref={el => {
                    if (!el) return;
                    // Post live data to preview endpoint and inject into iframe
                    const sender = { name: senderName, address_line1: senderLine1, address_line2: senderLine2, address_city: senderCity, address_state: senderState, address_zip: senderZip, address_country: senderCountry };
                    const recipient = { name: recipientName, address_line1: recipientLine1, address_line2: recipientLine2, address_city: recipientCity, address_state: recipientState, address_zip: recipientZip, address_country: recipientCountry };
                    fetch(`/api/templates/${previewTemplate}/preview`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sender, recipient, subject, body: messageContent.replace(/\n/g, '<br />') })
                    }).then(r => r.text()).then(html => {
                      const doc = el.contentDocument; if (doc) { doc.open(); doc.write(html); doc.close(); }
                    }).catch(() => {});
                  }}
                  style={{
                    width: '100%',
                    height: '600px',
                    border: 'none',
                    borderRadius: '4px',
                    background: 'white'
                  }}
                  title="Template Preview"
                  onError={() => {
                    console.log('Iframe failed to load, user can open in new tab');
                  }}
                />
                <div style={{ 
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <a 
                    href={`/api/templates/${previewTemplate}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3498db',
                      textDecoration: 'none',
                      fontWeight: '500'
                    }}
                  >
                    🔗 Open preview in new tab
                  </a>
                </div>
              </div>
              <div style={{ 
                marginTop: '16px', 
                padding: '16px', 
                background: '#f0f8ff', 
                borderRadius: '8px',
                fontSize: '14px',
                color: '#2c5aa0'
              }}>
                <strong>📝 Note:</strong> This is a sample preview with placeholder content. 
                Your actual letter will use the addresses and content you provide in the form above.
              </div>
            </div>
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e2e8f0',
              textAlign: 'center' as const
            }}>
              <button 
                onClick={() => {
                  setTemplateId(previewTemplate);
                  closePreview();
                }}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginRight: '12px'
                }}
              >
                ✓ Select This Template
              </button>
              <button 
                onClick={closePreview}
                style={{
                  background: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
