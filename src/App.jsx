import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, where } from 'firebase/firestore';
import { LogOut, Zap, Clock, TrendingUp, DollarSign, Users, Shield, Award, Sparkles, BookOpen, CreditCard, Lock, ArrowLeft, Send, Sun, Moon } from 'lucide-react';

// --- LOCAL STORAGE HOOK ---
const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
};

// Firebase Configuration from Environment Variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const appId = process.env.REACT_APP_APP_ID || "default-ai-studio-pro-app";
const initialAuthToken = process.env.REACT_APP_INITIAL_AUTH_TOKEN || null; 

// The core model for the subscription tiers
const SUBSCRIPTION_PLANS = {
  FREE: { name: 'Free Tier', limit: 5, color: 'bg-gray-700', icon: Zap, price: 'Free', monthly: 0.00 },
  PRO: { name: 'Pro', limit: 50, color: 'bg-indigo-600', icon: Clock, price: '$9.99/mo', monthly: 9.99 },
  ADVANCED: { name: 'Advanced', limit: 500, color: 'bg-purple-600', icon: TrendingUp, price: '$29.99/mo', monthly: 29.99 },
  LIFETIME: { name: 'Lifetime', limit: 99999, color: 'bg-yellow-600', icon: Award, price: '$499.00 (One-Time)', monthly: 499.00 },
};

// Function to call the Gemini API for content generation
const callGeminiAPI = async (prompt, systemInstruction) => {
    // ***************************************************************
    // FIX: For local development, REPLACE THE PLACEHOLDER KEY BELOW.
    const apiKey = "AIzaSyDe0orDATSVGqktyjxJ-NXa9BnMoYGB_sk"; // <-- PUT YOUR KEY HERE!
    // ***************************************************************
    
    // CORRECTED URL CONSTRUCTION: The API Key is now correctly appended.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    if (!apiKey || apiKey === "REPLACE_WITH_YOUR_GEMINI_API_KEY") {
        console.error("Gemini API Key is missing or invalid.");
        throw new Error("API Key is missing. Please check the src/App.jsx file and set your key.");
    }

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API Error Body:", errorBody);
            throw new Error(`API call failed: ${response.status} ${response.statusText}. Check console for details.`);
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
             throw new Error("AI returned no text content or response was blocked.");
        }
        return text;

    } catch (error) {
        console.error("Gemini API Call Failed:", error);
        throw new Error(error.message || "Failed to generate content. Please check the prompt, network connection, or API status.");
    }
};

// --- Custom Components ---

const StatusBadge = ({ planKey }) => {
  const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.FREE;
  const PlanIcon = plan.icon;
  return (
    <div className={`${plan.color} text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center shadow-lg`}>
      <PlanIcon className="w-3 h-3 mr-1" />
      {plan.name} Member
    </div>
  );
};

const TabButton = ({ children, isActive, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200 ${
      isActive
        ? `${isDarkMode ? 'bg-gray-900 text-indigo-400 border-b-2 border-indigo-500' : 'bg-gray-100 text-indigo-600 border-b-2 border-indigo-600'} shadow-inner`
        : `${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`
    }`}
  >
    {children}
  </button>
);

const IconButton = ({ children, onClick, disabled = false, loading = false, className = '', type = 'button' }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`flex items-center justify-center px-4 py-3 font-semibold transition-all duration-300 rounded-lg shadow-xl ${
            loading
                ? 'bg-gray-600 cursor-not-allowed'
                : disabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98] shadow-indigo-500/50'
        } ${className}`}
    >
        {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        ) : (
            children
        )}
    </button>
);


// --- Pages ---

const GeneratorPage = ({ db, auth, userId, userPlan, tokensUsed, tokensLimit, fetchUserData, setRoute, isDarkMode, setTokensUsed }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate' or 'summarize'

  const tokensRemaining = tokensLimit - tokensUsed;
  const isExceeded = tokensRemaining <= 0;
  const isDisabled = isExceeded;

  const quickActions = [
      { label: 'Generate Blog Outline', mode: 'generate', prompt: 'Create a compelling outline for a blog post about the top 5 MERN stack projects of 2024.' },
      { label: 'Summarize Report', mode: 'summarize', prompt: 'Paste a long paragraph here and click Summarize Report to see the magic!' },
      { label: 'Create Product Description', mode: 'generate', prompt: 'Write an exciting product description for a new AI-powered coffee maker.' },
  ];

  const handleQuickAction = (action) => {
    setMode(action.mode);
    setPrompt(action.prompt);
    setError('');
    // Optionally trigger generation if the prompt is not a placeholder
    if (action.label !== 'Summarize Report' && !action.prompt.includes('Paste a long paragraph')) {
        handleGenerate(action.mode, action.prompt);
    }
  };


  const handleGenerate = async (currentMode = mode, currentPrompt = prompt) => {
    // Only set the prompt if the button was clicked and it's a new mode/prompt combination
    if (currentPrompt !== prompt) {
        setPrompt(currentPrompt);
    }

    if (isDisabled) {
        setError("Token limit reached. Please upgrade your subscription to continue.");
        return;
    }
    if (!currentPrompt.trim() || currentPrompt.includes('Paste a long paragraph here')) {
        setError("Please enter a valid prompt or paste text to proceed.");
        return;
    }

    setLoading(true);
    setError('');
    setGeneratedText('');
    
    // Determine the system instruction based on the current/selected mode
    const instruction = currentMode === 'generate'
        ? "You are a professional content creator. Generate a compelling, well-structured, and plagiarism-free text based on the user's prompt."
        : "You are an expert document summarizer. Take the user's text and provide a concise, high-quality summary in three key bullet points, followed by a one-paragraph analysis.";

    try {
        // 1. Update token count first (optimistic update)
        const newTokenCount = tokensUsed + 1;
        setTokensUsed(newTokenCount);
        
        // 2. Call AI Service
        const generated = await callGeminiAPI(currentPrompt, instruction);

        try {
            // 3. Update token count in Firestore
            const userRef = doc(db, 'artifacts', appId, 'users', userId, 'user_data', 'profile');
            await setDoc(userRef, { 
                tokensUsedThisMonth: newTokenCount 
            }, { merge: true });
            console.log('Token count updated in Firestore:', newTokenCount);
            
            // 4. Save History
            const historyCollection = collection(db, 'artifacts', appId, 'users', userId, 'content_history');
            await setDoc(doc(historyCollection), {
                prompt: currentPrompt,
                generatedText: generated,
                type: currentMode === 'generate' ? 'Content Generation' : 'Document Summary',
                date: new Date().toISOString(),
                plan: userPlan,
            });
            
            setGeneratedText(generated);
        } catch (dbError) {
            console.error('Database error:', dbError);
            // Revert the token count if Firestore update fails
            setTokensUsed(tokensUsed);
            throw new Error('Failed to update your account. Please try again.');
        }
    } catch (e) {
        console.error("Generation failed:", e);
        setError(e.message || "An unexpected error occurred during generation.");
    } finally {
        setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedText) {
      document.execCommand('copy', false, generatedText);
      setError('Content copied to clipboard!');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getTokenBadgeClasses = () => {
    if (tokensLimit === 99999) return `text-yellow-500 ${isDarkMode ? 'bg-gray-800 border-yellow-700 hover:bg-gray-700' : 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200'} cursor-default`;
    
    const percentage = (tokensUsed / tokensLimit) * 100;
    
    if (isExceeded) return `text-red-500 ${isDarkMode ? 'bg-gray-800 border-red-700' : 'bg-red-100 border-red-300'} hover:underline`;
    if (percentage > 80) return `text-orange-500 ${isDarkMode ? 'bg-gray-800 border-orange-700' : 'bg-orange-100 border-orange-300'} hover:underline`;
    
    return `text-indigo-500 ${isDarkMode ? 'bg-gray-800 border-indigo-700' : 'bg-indigo-100 border-indigo-300'} hover:underline`;
  };


  return (
    <div className="p-6">
        {/* Centralized Content Area */}
        <div className="max-w-3xl mx-auto text-center">
            
            {/* Centered Heading */}
            <h2 className={`text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3 tracking-tight`}>
                What should we create?
            </h2>
            <p className={`text-xl ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600/80'} mb-8`}>
                Generate, Summarize, and Refine content using the power of Gemini AI.
            </p>

            {/* Input Container (Matches Image Aesthetic - Now with integrated Token Badge) */}
            <div className={`relative ${isDarkMode ? 'bg-gray-900 shadow-indigo-900/40 border-gray-700/50' : 'bg-white shadow-xl shadow-gray-300/50 border-gray-300'} rounded-xl shadow-2xl border p-3 flex flex-col`}>
                
                {/* Text Area */}
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your content need or paste text to summarize..."
                    rows={5}
                    className={`flex-grow p-2 ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'} bg-transparent border-none focus:ring-0 focus:outline-none`}
                    style={{ resize: 'none' }}
                />
                
                {/* Bottom Bar: Token Status + Send Button */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                    
                    {/* Compact Token Status Badge (Oval) */}
                    <button 
                        onClick={() => tokensLimit !== 99999 ? setRoute('billing') : null}
                        disabled={tokensLimit === 99999}
                        className={`flex items-center space-x-2 text-sm px-3 py-1.5 rounded-full font-semibold border transition-colors ${getTokenBadgeClasses()} ${tokensLimit === 99999 ? 'cursor-default' : 'cursor-pointer'}`}
                        title={tokensLimit === 99999 ? "Unlimited Access" : "Click to view plan and upgrade"}
                    >
                        <Shield className="w-4 h-4" />
                        <span className="text-xs sm:text-sm">
                            {tokensLimit === 99999 ? 'Unlimited Access' : 
                             isExceeded ? 'Limit Reached' : 
                             `${tokensRemaining} Tokens Left`}
                        </span>
                    </button>
                    

                    {/* Submit Button on the Right */}
                    <IconButton 
                        onClick={() => handleGenerate()} 
                        loading={loading} 
                        disabled={isDisabled || !prompt.trim()}
                        className="w-12 h-12 flex-shrink-0 !p-0"
                    >
                        <Send className="w-5 h-5" />
                    </IconButton>
                </div>
            </div>

            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
            
            {/* Quick Action Buttons (Matching Image) */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
                {quickActions.map(action => (
                    <button
                        key={action.label}
                        onClick={() => handleQuickAction(action)}
                        className={`flex items-center px-4 py-2 rounded-full font-medium transition-colors border shadow-md ${
                            action.mode === 'generate' ? (isDarkMode ? 'text-indigo-400 hover:bg-indigo-900/30' : 'text-indigo-600 hover:bg-indigo-50/50') : 
                                                         (isDarkMode ? 'text-purple-400 hover:bg-purple-900/30' : 'text-purple-600 hover:bg-purple-50/50')
                        } ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'}`}
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {action.label}
                    </button>
                ))}
            </div>
            

            {/* Generated Output - With Glowing Effect */}
            {generatedText && (
                <div className={`mt-8 p-6 rounded-xl shadow-2xl shadow-indigo-500/30 border ${isDarkMode ? 'bg-gray-900 border-indigo-700' : 'bg-gray-50 border-indigo-400'} text-left`}>
                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} mb-3 flex justify-between items-center`}>
                        <BookOpen className="w-5 h-5 mr-2" />
                        AI Output Stream
                        <button onClick={handleCopy} className={`text-sm ${isDarkMode ? 'text-gray-400 hover:text-indigo-400' : 'text-gray-600 hover:text-indigo-600'} transition-colors`}>
                            (Copy to Clipboard)
                        </button>
                    </h3>
                    <div className={`prose prose-sm max-w-none ${isDarkMode ? 'text-gray-300' : 'text-gray-800'} whitespace-pre-wrap overflow-x-auto`}>
                        {generatedText}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

const HistoryPage = ({ history, loading, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return history.filter(item =>
      item.prompt.toLowerCase().includes(lowerCaseSearch) ||
      item.generatedText.toLowerCase().includes(lowerCaseSearch) ||
      item.type.toLowerCase().includes(lowerCaseSearch)
    );
  }, [history, searchTerm]);

  return (
    <div className="p-6">
      <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-6 flex items-center`}>
        <Clock className="w-7 h-7 mr-2 text-indigo-400" />
        Generation History Log
      </h2>
      <input
        type="text"
        placeholder="Search prompts, summaries, or content..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`w-full p-3 mb-6 ${isDarkMode ? 'text-white bg-gray-800 border-gray-700' : 'text-gray-900 bg-gray-100 border-gray-300'} rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-inner`}
      />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading history...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No generation history found. Start creating content!</div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item, index) => (
            <div key={index} className={`p-4 rounded-xl shadow-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800 hover:border-indigo-600' : 'bg-white border-gray-200 hover:border-indigo-400'} transition-colors duration-200`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{item.type}</span>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString()}</span>
              </div>
              <p className={`italic mb-2 line-clamp-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>Prompt: "{item.prompt}"</p>
              <div className={`text-sm line-clamp-3 overflow-hidden ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                {item.generatedText}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PlanCard = ({ planKey, currentPlan, handleSelectPlan, isDarkMode }) => {
    const plan = SUBSCRIPTION_PLANS[planKey];
    const { name, limit, color, icon: Icon, price } = plan;
    const isCurrent = currentPlan === planKey;

    const limitDisplay = limit === 99999 ? 'Unlimited' : `${limit} Tokens/Month`;
    const buttonText = isCurrent ? 'Current Plan Active' : (planKey === 'LIFETIME' ? 'Purchase Lifetime Access' : 'Upgrade Now');

    const benefits = {
        FREE: ['5 Tokens/Month', 'Basic Content Generation', 'History limited to 1 week'],
        PRO: ['50 Tokens/Month', 'Document Summarization', 'Full History Access'],
        ADVANCED: ['500 Tokens/Month', 'Priority AI Models', 'Advanced Tone Controls'],
        LIFETIME: ['Unlimited Tokens (Forever)', 'All Advanced Features', 'Future Feature Access'],
    };

    return (
        <div className={`flex flex-col rounded-xl p-6 shadow-2xl transition-all duration-300 ${
            isCurrent 
            ? 'bg-indigo-950 border-4 border-indigo-400 ring-4 ring-indigo-400/50 shadow-indigo-500/40 scale-[1.03]' 
            : isDarkMode
                ? 'bg-gray-900 border border-gray-700 hover:border-indigo-600 hover:shadow-lg'
                : 'bg-white border border-gray-300 hover:border-indigo-400 hover:shadow-md'
        }`}>
            <div className="flex items-center mb-4">
                <Icon className={`w-8 h-8 ${color.replace('bg-', 'text-')} p-1.5 rounded-full mr-3`} />
                <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
            </div>
            <p className={`text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>{price}</p>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>{limitDisplay}</p>

            <div className="space-y-2 mb-8 flex-grow">
                {benefits[planKey].map((benefit, i) => (
                    <div key={i} className={`flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Sparkles className="w-4 h-4 mr-2 text-green-400" />
                        <span className="text-sm">{benefit}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => isCurrent ? null : handleSelectPlan(planKey)}
                disabled={isCurrent}
                className={`w-full py-3 rounded-lg font-bold text-white transition-all duration-300 shadow-xl ${
                    isCurrent
                        ? 'bg-green-600 cursor-not-allowed hover:bg-green-600'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] shadow-indigo-500/50'
                }`}
            >
                {buttonText}
            </button>
        </div>
    );
};

const PaymentPage = ({ userId, selectedPlanKey, fetchUserData, setRoute, isDarkMode, db }) => {
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
    const [paymentMethod, setPaymentMethod] = useState('card');
    
    // Mock payment fields
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [upiId, setUpiId] = useState('');

    // Get the plan details
    const plan = selectedPlanKey ? SUBSCRIPTION_PLANS[selectedPlanKey] : null;

    // If no valid plan is selected, show error and redirect to billing
    if (!plan || !selectedPlanKey) {
        return (
            <div className={`p-6 text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                No plan selected or invalid plan. <button 
                    onClick={() => setRoute('billing')} 
                    className={`${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'} underline`}
                >
                    Return to Billing
                </button>
            </div>
        );
    }

    const totalAmount = plan.monthly * 1.05;

    // Use the db instance passed from App component
    if (!db) {
        return (
            <div className={`p-6 text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                Database connection error. Please try again later.
            </div>
        );
    }

    const handleFinalizePayment = async (e) => {
        e.preventDefault();

        if (plan.monthly > 0) {
            if (paymentMethod === 'card' && (!cardNumber || !cardName)) {
                setStatusMessage({ type: 'error', text: "Please fill out mock card details." });
                return;
            }
            if (paymentMethod === 'upi' && !upiId) {
                 setStatusMessage({ type: 'error', text: "Please enter a mock UPI ID." });
                 return;
            }
        }

        setLoading(true);
        setStatusMessage({ type: 'info', text: `Processing secure payment of $${totalAmount.toFixed(2)}...` });

        try {
            // Simulated payment delay and success
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay for realism

            // 1. Update plan and reset token usage in Firestore
            const newLimit = plan.limit;
            const userRef = doc(db, 'artifacts', appId, 'users', userId, 'user_data', 'profile');

            await setDoc(userRef, {
                plan: selectedPlanKey,
                tokensLimit: newLimit,
                tokensUsedThisMonth: 0,
            }, { merge: true });

            // 2. Refresh user data and navigate
            await fetchUserData(userId);
            setStatusMessage({ type: 'success', text: `Payment successful! You are now on the ${plan.name} plan.` });
            
            setTimeout(() => {
                setRoute('billing'); // Redirect back to billing page
            }, 3000);

        } catch (error) {
            console.error("Payment finalization failed:", error);
            setStatusMessage({ type: 'error', text: "Payment processing failed. Try again." });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="p-6 flex flex-col items-center">
            <div className={`w-full max-w-2xl p-8 rounded-xl shadow-2xl border ${isDarkMode ? 'bg-gray-900 border-indigo-700' : 'bg-white border-indigo-400'}`}>
                <button 
                    onClick={() => setRoute('billing')} 
                    className={`flex items-center text-sm mb-6 transition-colors ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Plans
                </button>
                <h2 className={`text-3xl font-bold mb-6 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <CreditCard className="w-7 h-7 mr-2 text-indigo-400" />
                    Secure Checkout
                </h2>

                {statusMessage.text && (
                    <div className={`p-3 rounded-lg text-sm mb-6 font-medium ${
                        statusMessage.type === 'success' ? 'bg-green-700 text-white' :
                        statusMessage.type === 'error' ? 'bg-red-700 text-white' :
                        'bg-indigo-700 text-white'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Order Summary */}
                    <div className={`md:col-span-1 p-5 rounded-lg border h-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Order Summary</h3>
                        <div className={`flex justify-between mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                            <span>{plan.name} Subscription:</span>
                            <span>${plan.monthly.toFixed(2)}</span>
                        </div>
                        <div className={`flex justify-between text-sm pb-2 mb-2 border-b ${isDarkMode ? 'text-gray-400 border-gray-700' : 'text-gray-600 border-gray-300'}`}>
                            <span>Taxes (Simulated 5%):</span>
                            <span>${(plan.monthly * 0.05).toFixed(2)}</span>
                        </div>
                        <div className={`flex justify-between text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            <span>Total Due:</span>
                            <span>${(plan.monthly * 1.05).toFixed(2)}</span>
                        </div>
                        {/* Added Rupee/INR conversion display for UPI realism */}
                        <div className={`text-sm mt-1 flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                             <span>Equivalent (INR):</span>
                             <span>₹{(totalAmount * 83.33).toFixed(2)}</span>
                        </div>

                        <p className={`text-xs mt-2 flex items-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            <Lock className="w-3 h-3 mr-1" /> All transactions are 256-bit encrypted.
                        </p>
                    </div>

                    {/* Payment Form */}
                    <div className="md:col-span-2 space-y-5">
                        <h3 className={`text-xl font-semibold mb-2 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            <CreditCard className="w-5 h-5 mr-2 text-indigo-400" /> Payment Details
                        </h3>

                        {/* Payment Method Selector */}
                        {plan.monthly > 0 && (
                            <div className="flex space-x-4 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors border ${
                                        paymentMethod === 'card' 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                        : isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <CreditCard className="w-4 h-4 mr-2" /> Card
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('upi')}
                                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors border ${
                                        paymentMethod === 'upi' 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                        : isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <Users className="w-4 h-4 mr-2" /> UPI
                                </button>
                            </div>
                        )}
                        
                        <form onSubmit={handleFinalizePayment} className="space-y-5">
                            {/* --- CARD FORM --- */}
                            {paymentMethod === 'card' && plan.monthly > 0 && (
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Cardholder Name</span>
                                        <input
                                            type="text"
                                            value={cardName}
                                            onChange={(e) => setCardName(e.target.value)}
                                            placeholder="John Doe"
                                            className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner mt-1 ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                                            required
                                        />
                                    </label>
                                    
                                    <label className="block">
                                        <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Card Number</span>
                                        <input
                                            type="text"
                                            value={cardNumber}
                                            onChange={(e) => setCardNumber(e.target.value)}
                                            placeholder="XXXX XXXX XXXX XXXX (Mock Input)"
                                            maxLength="16"
                                            className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner mt-1 ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                                            required
                                        />
                                    </label>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Expiry (MM/YY)</span>
                                            <input
                                                type="text"
                                                placeholder="01/25"
                                                maxLength="5"
                                                className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner mt-1 ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                                                required
                                            />
                                        </label>
                                        <label className="block">
                                            <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>CVV</span>
                                            <input
                                                type="text"
                                                placeholder="123"
                                                maxLength="3"
                                                className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner mt-1 ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                                                required
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* --- UPI FORM --- */}
                            {paymentMethod === 'upi' && plan.monthly > 0 && (
                                <div className={`space-y-4 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                                    <p className={`text-sm mb-3 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Select app to simulate deep link for payment:
                                    </p>
                                    
                                    {/* UPI App Buttons (Simulated Deep Links) */}
                                    <div className="flex space-x-3 mb-4">
                                        <button type="button" className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-500">Google Pay</button>
                                        <button type="button" className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-500">Paytm</button>
                                        <button type="button" className="px-3 py-1.5 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-500">PhonePe</button>
                                    </div>

                                    <label className="block">
                                        <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Enter UPI ID (Mock Input)</span>
                                        <input
                                            type="text"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                            placeholder="mockuser@bankupi"
                                            className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner mt-1 ${isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-200 text-gray-900 border-gray-300'}`}
                                            required
                                        />
                                    </label>
                                </div>
                            )}

                            {/* --- FREE PLAN / FINAL BUTTON --- */}
                            {(plan.monthly === 0 || paymentMethod === 'card' || paymentMethod === 'upi') && (
                                <IconButton type="submit" loading={loading} className="w-full mt-6">
                                    {plan.monthly > 0 ? `Confirm Payment of $${(totalAmount).toFixed(2)}` : 'Activate Free Plan'}
                                </IconButton>
                            )}
                        </form>
                    </div>
                </div>
                
                <p className={`text-sm text-center mt-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                    By confirming, you agree to the simulated Terms of Service.
                </p>
            </div>
        </div>
    );
};

const BillingPage = ({ userId, userPlan, fetchUserData, setRoute, isDarkMode }) => {
    
    // Function to handle plan selection and navigation
    const handleSelectPlan = (planKey) => {
        // Pass both the route and planKey to setRoute
        setRoute('payment', planKey);
    };

    return (
        <div className="p-6">
            <h2 className={`text-3xl font-bold mb-4 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <DollarSign className="w-7 h-7 mr-2 text-indigo-400" />
                Billing & Subscription Portal
            </h2>
            <div className={`p-4 rounded-xl shadow-xl mb-6 flex justify-between items-center border ${isDarkMode ? 'bg-gray-900 border-indigo-700' : 'bg-white border-indigo-400'}`}>
                <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>Your Active Plan:</p>
                <StatusBadge planKey={userPlan} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.keys(SUBSCRIPTION_PLANS).map((key) => (
                    <PlanCard
                        key={key}
                        planKey={key}
                        currentPlan={userPlan}
                        handleSelectPlan={handleSelectPlan} // Use the new navigation handler
                        isDarkMode={isDarkMode}
                    />
                ))}
            </div>
            <p className={`text-center text-sm mt-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                **Note: Clicking 'Upgrade Now' takes you to a secure mock payment page.**
            </p>
        </div>
    );
};

const AuthPage = ({ setIsAuthReady, setUserId, isDarkMode }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Simplified authentication logic (since we rely on __initial_auth_token)
    // This component serves as a fallback/mock for standard email/password flow
    const handleAuth = async () => {
        setError('');
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);
        try {
            // Simulate Authentication Success
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate a deterministic user ID based on email for mock session
            const mockUserId = btoa(email).slice(0, 20); 

            // Simulate setting user data and logging in
            setUserId(mockUserId);
            setIsAuthReady(true);
        } catch (e) {
            setError("Authentication failed. (Simulated Error)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-gray-200'}`}>
            <div className={`p-8 rounded-xl shadow-2xl w-full max-w-md border ${isDarkMode ? 'bg-gray-900 border-indigo-700' : 'bg-white border-indigo-400'}`}>
                <h2 className={`text-3xl font-extrabold text-center mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email (e.g., user@example.com)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                    />
                    <input
                        type="password"
                        placeholder="Password (Simulated)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full p-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 shadow-inner ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-100 text-gray-900 border-gray-300'}`}
                    />
                </div>
                {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
                <IconButton onClick={handleAuth} loading={loading} className="w-full mt-6">
                    {isLogin ? 'Access Studio' : 'Secure Account'}
                </IconButton>
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className={`w-full text-center text-sm mt-4 transition-colors ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}
                >
                    {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
                </button>
            </div>
        </div>
    );
};


// --- Main Application Component ---

const App = () => {
  const [route, setRoute] = useState('generator');
  const [selectedPlanKey, setSelectedPlanKey] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useLocalStorage('themeMode', true); // Default to Dark Mode

  // User State Data
  const [userPlan, setUserPlan] = useState('FREE');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokensLimit, setTokensLimit] = useState(SUBSCRIPTION_PLANS.FREE.limit);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Custom navigation function to handle state passing
  const navigateTo = (newRoute, planKey = null) => {
    setRoute(newRoute);
    setSelectedPlanKey(planKey);
  };

  const toggleTheme = () => {
      setIsDarkMode(prev => !prev);
  };


  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing.");
        // Fallback to mock auth if Firebase is unavailable
        setUserId('demo-user');
        setUserPlan('FREE');
        setTokensLimit(SUBSCRIPTION_PLANS.FREE.limit);
        setIsAuthReady(true);
        return;
    }

    const initializeFirebase = async () => {
      try {
          const app = initializeApp(firebaseConfig);
          const firestore = getFirestore(app);
          const firebaseAuth = getAuth(app);
          setDb(firestore);
          setAuth(firebaseAuth);

          // Try to get the current user first
          const currentUser = firebaseAuth.currentUser;
          
          if (currentUser) {
              setUserId(currentUser.uid);
              await fetchUserData(currentUser.uid, firestore);
              setIsAuthReady(true);
              return;
          }

          // If no user is signed in, try anonymous auth
          try {
              if (initialAuthToken) {
                  await signInWithCustomToken(firebaseAuth, initialAuthToken);
              } else {
                  // Try anonymous sign-in with error handling
                  const userCredential = await signInAnonymously(firebaseAuth);
                  setUserId(userCredential.user.uid);
                  await fetchUserData(userCredential.user.uid, firestore);
              }
          } catch (authError) {
              console.warn("Authentication error, falling back to demo mode:", authError);
              setUserId('demo-user');
              setUserPlan('FREE');
              setTokensLimit(SUBSCRIPTION_PLANS.FREE.limit);
          }
          
          setIsAuthReady(true);
      } catch (e) {
          console.error("Firebase Initialization Error:", e);
          // Fallback to demo mode
          setUserId('demo-user');
          setUserPlan('FREE');
          setTokensLimit(SUBSCRIPTION_PLANS.FREE.limit);
          setIsAuthReady(true);
      }
    };

    initializeFirebase();
    
    // Cleanup function
    return () => {
        // Any cleanup if needed
    };
  }, []);

  // 2. Fetch User Profile Data and set up listener
  const fetchUserData = async (uid, currentDb = db) => {
    if (!uid || !currentDb) {
        console.log('No UID or DB available, using demo data');
        setUserPlan('FREE');
        setTokensUsed(0);
        setTokensLimit(SUBSCRIPTION_PLANS.FREE.limit);
        return;
    }

    try {
        console.log('Fetching user data for UID:', uid);
        const userRef = doc(currentDb, 'artifacts', appId, 'users', uid, 'user_data', 'profile');
        
        try {
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('User data found:', data);
                setUserPlan(data.plan || 'FREE');
                setTokensUsed(data.tokensUsedThisMonth || 0);
                setTokensLimit(data.tokensLimit || SUBSCRIPTION_PLANS[data.plan || 'FREE'].limit);
            } else {
                console.log('No user data found, initializing new profile');
                // Initialize new user profile
                const planKey = 'FREE';
                const initialData = {
                    plan: planKey,
                    tokensUsedThisMonth: 0,
                    tokensLimit: SUBSCRIPTION_PLANS[planKey].limit,
                    createdAt: new Date().toISOString()
                };
                await setDoc(userRef, initialData, { merge: true });
                setUserPlan(planKey);
                setTokensUsed(0);
                setTokensLimit(SUBSCRIPTION_PLANS[planKey].limit);
            }
        } catch (firestoreError) {
            console.error('Firestore Error:', firestoreError);
            // Fallback to local state if Firestore fails
            setUserPlan('FREE');
            setTokensUsed(0);
            setTokensLimit(SUBSCRIPTION_PLANS.FREE.limit);
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
    }
  };

  // 3. Listen for History Data
  useEffect(() => {
    if (!db || !userId) {
        console.log('No DB or userId, skipping history listener setup');
        return;
    }

    console.log('Setting up history listener for user:', userId);
    setLoadingHistory(true);
    
    try {
        const historyQuery = query(
            collection(db, 'artifacts', appId, 'users', userId, 'content_history'),
            where('plan', '!=', null)
        );

        const unsubscribe = onSnapshot(historyQuery, 
            (snapshot) => {
                try {
                    const loadedHistory = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    })).sort((a, b) => {
                        const dateA = a.date ? new Date(a.date) : new Date(0);
                        const dateB = b.date ? new Date(b.date) : new Date(0);
                        return dateB - dateA;
                    });
                    console.log('History data loaded, items:', loadedHistory.length);
                    setHistory(loadedHistory);
                } catch (processError) {
                    console.error('Error processing history data:', processError);
                    setHistory([]);
                } finally {
                    setLoadingHistory(false);
                }
            },
            (error) => {
                console.error("Error in history listener:", error);
                setHistory([]);
                setLoadingHistory(false);
            }
        );

        return () => {
            console.log('Cleaning up history listener');
            unsubscribe();
        };
    } catch (setupError) {
        console.error('Error setting up history listener:', setupError);
        setHistory([]);
        setLoadingHistory(false);
    }
  }, [db, userId]);

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
        if (auth) {
            await signOut(auth);
            setUserId(null);
            setUserPlan('FREE');
        } else {
            // Mock signout for fallback mode
            setUserId(null);
            setUserPlan('FREE');
        }
        navigateTo('generator');
    } catch (error) {
        console.error("Error signing out:", error);
    }
  };

  // Render Logic
  let content;
  if (!isAuthReady) {
    content = <div className="text-center py-20 text-indigo-400 text-xl font-medium">Initializing Application and Authentication...</div>;
  } else if (!userId) {
    content = <AuthPage setIsAuthReady={setIsAuthReady} setUserId={setUserId} isDarkMode={isDarkMode} />;
  } else {
    switch (route) {
      case 'generator':
        content = <GeneratorPage
            db={db}
            auth={auth}
            userId={userId}
            userPlan={userPlan}
            tokensUsed={tokensUsed}
            tokensLimit={tokensLimit}
            fetchUserData={() => fetchUserData(userId, db)}
            setRoute={navigateTo}
            isDarkMode={isDarkMode}
            setTokensUsed={setTokensUsed}
        />;
        break;
      case 'history':
        content = <HistoryPage history={history} loading={loadingHistory} isDarkMode={isDarkMode} />;
        break;
      case 'billing':
        content = <BillingPage userId={userId} userPlan={userPlan} fetchUserData={() => fetchUserData(userId, db)} setRoute={navigateTo} isDarkMode={isDarkMode} />;
        break;
      case 'payment':
          content = <PaymentPage 
              userId={userId} 
              selectedPlanKey={selectedPlanKey} 
              fetchUserData={() => fetchUserData(userId, db)} 
              setRoute={navigateTo} 
              isDarkMode={isDarkMode}
              db={db}
          />;
          break;
      default:
        content = <div className="text-center py-20 text-red-400">Page Not Found</div>;
    }
  }

  const ThemeIcon = isDarkMode ? Sun : Moon;

  return (
    <div className={`min-h-screen font-sans flex justify-center ${isDarkMode ? 'bg-slate-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      <div className="w-full max-w-7xl">
        {/* Header/Navigation - High-tech control panel look */}
        <header className={`${isDarkMode ? 'bg-gray-900 shadow-2xl border-indigo-900' : 'bg-white shadow-md border-gray-300'} border-b sticky top-0 z-10`}>
          <div className="flex items-center justify-between p-4 md:px-8">
            <div className="flex items-center">
              <Sparkles className="w-7 h-7 text-indigo-500 mr-3" />
              <h1 className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'} tracking-wider`}>AI STUDIO PRO</h1>
            </div>

            {userId && (
              <>
                {/* Main Tabs */}
                <nav className={`hidden md:flex space-x-1 border rounded-lg p-1 shadow-inner ${isDarkMode ? 'border-gray-700 bg-gray-950' : 'border-gray-300 bg-gray-50'}`}>
                    <TabButton isActive={route === 'generator'} onClick={() => navigateTo('generator')} isDarkMode={isDarkMode}>
                        Generator
                    </TabButton>
                    <TabButton isActive={route === 'history'} onClick={() => navigateTo('history')} isDarkMode={isDarkMode}>
                        History
                    </TabButton>
                    <TabButton isActive={route === 'billing'} onClick={() => navigateTo('billing')} isDarkMode={isDarkMode}>
                        Billing ({userPlan})
                    </TabButton>
                </nav>

                {/* User Info & Sign Out */}
                <div className="flex items-center space-x-3">
                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                        <ThemeIcon className="w-5 h-5" />
                    </button>
                    
                    <div className="hidden sm:block text-right">
                      <p className={`text-sm font-semibold truncate max-w-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{userId}</p>
                      <StatusBadge planKey={userPlan} />
                    </div>
                    <button
                      onClick={handleSignOut}
                      title="Sign Out"
                      className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-400 hover:bg-red-600 hover:text-white' : 'bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white'}`}
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                </div>
              </>
            )}
          </div>
          {/* Mobile Navigation */}
           {userId && (
              <nav className={`flex md:hidden justify-around border-t ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-gray-100'}`}>
                    <TabButton isActive={route === 'generator'} onClick={() => navigateTo('generator')} isDarkMode={isDarkMode}>
                        Generator
                    </TabButton>
                    <TabButton isActive={route === 'history'} onClick={() => navigateTo('history')} isDarkMode={isDarkMode}>
                        History
                    </TabButton>
                    <TabButton isActive={route === 'billing'} onClick={() => navigateTo('billing')} isDarkMode={isDarkMode}>
                        Billing
                    </TabButton>
              </nav>
           )}
        </header>

        {/* Main Content Area - Radial Gradient for Depth */}
        <main className="min-h-[calc(100vh-80px)]" style={{ background: isDarkMode ? 'radial-gradient(circle at top, rgba(30, 60, 100, 0.1) 0%, rgba(15, 23, 42, 1) 70%)' : 'none' }}>
          {content}
        </main>
      </div>
    </div>
  );
};

export default App;
