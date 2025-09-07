import React, { useState, useCallback } from 'react';

// --- Helper Components ---

const CodeInput = ({ value, onChange, placeholder, height = 'h-96' }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full ${height} bg-gray-800 border border-gray-700 rounded-md p-4 text-gray-300 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm`}
  />
);

const OutputDisplay = ({ content, isLoading, error }) => {
  const Loader = () => (
    <div className="flex justify-center items-center h-full">
      <div className="border-4 border-gray-600 border-t-blue-500 rounded-full w-12 h-12 animate-spin"></div>
    </div>
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content).catch(err => console.error('Failed to copy text: ', err));
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full flex flex-col relative">
      <h2 className="text-xl font-semibold text-white mb-4">AI Output</h2>
      <div className="flex-grow bg-gray-800 border border-gray-700 rounded-md relative min-h-[200px]">
        {isLoading ? <Loader /> : (
          <>
            <pre className="w-full h-full p-4 text-gray-300 whitespace-pre-wrap overflow-auto font-mono text-sm"><code id="ai-output">{content}</code></pre>
            {content && (
              <button onClick={copyToClipboard} className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 text-xs rounded-md transition-colors duration-200 opacity-50 hover:opacity-100">
                Copy
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
    </div>
  );
};


// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('generate');

  // State for Doc Generation
  const [sourceCode, setSourceCode] = useState(sampleFullDocCode);
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // State for Update Suggestion
  const [originalCode, setOriginalCode] = useState(sampleOriginalCode);
  const [updatedCode, setUpdatedCode] = useState(sampleUpdatedCode);
  const [suggestion, setSuggestion] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  const API_KEY = "AIzaSyClNMo4t9I7nDcIUKqnp78aUO6ek1D_Ycw"; // In this environment, the API key is provided automatically.

  // This is where you might point to an internal iFAST service proxy if needed.
  const GEMINI_API_GATEWAY_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;


  const callGeminiAPI = useCallback(async (prompt, setState, setError, setIsLoading) => {
    setIsLoading(true);
    setError('');
    setState('');

    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    let success = false;
    let attempt = 0;
    const maxAttempts = 5;
    const initialDelay = 1000; // 1 second

    while (attempt < maxAttempts && !success) {
      try {
        const response = await fetch(GEMINI_API_GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(`API Error: ${response.status}. Details: ${JSON.stringify(errorBody.error)}`);
        }

        const result = await response.json();

        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = result.candidates[0].content.parts[0].text;
          setState(text.replace(/^```markdown\n/, '').replace(/\n```$/, ''));
          success = true;
        } else {
          throw new Error("Invalid response structure from API.");
        }

      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, error.message);
        if (attempt >= maxAttempts) {
          setError(`Request failed after ${maxAttempts} attempts: ${error.message}`);
        } else {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }
    setIsLoading(false);
  }, [GEMINI_API_GATEWAY_URL]);


  const handleGenerateDoc = () => {
    if (!sourceCode.trim()) {
      setGenError('Please paste your source code into the input box.');
      return;
    }

    const prompt = `
            You are a senior software engineer performing a code review. Analyze the following source code and generate a comprehensive, clear, and well-structured technical documentation in Markdown format. The documentation must be practical and easy for new developers to understand. Directly start with the result of analysis without introducing yourself. 

            **Source Code to Document:**
            \`\`\`
            ${sourceCode}
            \`\`\`
        `;
    callGeminiAPI(prompt, setGeneratedDoc, setGenError, setIsGenerating);
  };

  const handleSuggestUpdate = () => {
    if (!originalCode.trim() || !updatedCode.trim()) {
      setSuggestError('Please provide both original and updated code versions.');
      return;
    }

    const prompt = `
            You are a senior software engineer performing a code review. Your task is to analyze the difference between two versions of a source code and generate a documentation update suggestion in Markdown.
            This suggestion should be concise and formatted for inclusion in a GitHub Pull Request description.

            **Instructions:**
            - Focus *only* on what has changed.
            - If an endpoint is added, document the new endpoint.
            - If an endpoint is modified (e.g., path change, parameter added), describe the changes clearly.
            - If an endpoint is removed, state which one was removed.
            - Use a 'diff' like format (e.g., using '+' for additions, '-' for removals) where it adds clarity.

            Directly start with the result of analysis without introducing yourself. 
            
            **Original Code:**
            \`\`\`
            ${originalCode}
            \`\`\`

            **Updated Code:**
            \`\`\`
            ${updatedCode}
            \`\`\`

            **Documentation Update Suggestion:**
        `;
    callGeminiAPI(prompt, setSuggestion, setSuggestError, setIsSuggesting);
  };


  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-1/2 py-2.5 px-4 rounded-md font-semibold focus:outline-none transition-colors duration-300 ${activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-900 text-gray-300 min-h-screen p-4 sm:p-6 md:p-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-gray-800 p-3 rounded-full mb-4">
            <svg className="h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.007 1.11-1.226l.554-.221a.75.75 0 011.002.664v1.223a.75.75 0 00.364.63l.555.333a.75.75 0 010 1.328l-.555.333a.75.75 0 00-.364.63v1.223a.75.75 0 01-1.002.664l-.554-.221a1.125 1.125 0 00-1.11-1.226" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">DocuSync AI Assistant</h1>
          <p className="mt-3 text-lg text-gray-400">Smarter, Faster, Maintainable Documentation</p>
        </header>

        <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 text-gray-300 px-4 py-3 rounded-lg relative mb-8 text-center" role="alert">
          <strong className="font-bold">Integration Status:</strong>
          <span className="block sm:inline ml-2">Connected to Gemini API.</span>
        </div>

        <div className="flex justify-center mb-8 bg-gray-800 border border-gray-700 rounded-lg p-1 max-w-md mx-auto">
          <TabButton id="generate" label="Generate Full Doc" />
          <TabButton id="suggest" label="Suggest Update" />
        </div>

        <main>
          {activeTab === 'generate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4">Source Code</h2>
                <CodeInput value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} placeholder="Paste your code here..." />
                <button onClick={handleGenerateDoc} disabled={isGenerating} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center">
                  {isGenerating ? 'Generating...' : 'Generate Documentation'}
                </button>
              </div>
              <OutputDisplay content={generatedDoc} isLoading={isGenerating} error={genError} />
            </div>
          )}

          {activeTab === 'suggest' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4">Original Code Version</h2>
                  <CodeInput value={originalCode} onChange={(e) => setOriginalCode(e.target.value)} placeholder="Paste the original code version..." height="h-80" />
                </div>
                <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4">Updated Code Version</h2>
                  <CodeInput value={updatedCode} onChange={(e) => setUpdatedCode(e.target.value)} placeholder="Paste the new, updated code version..." height="h-80" />
                </div>
                <button onClick={handleSuggestUpdate} disabled={isSuggesting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center mt-6 xl:mt-0">
                  {isSuggesting ? 'Analyzing...' : 'Analyze Diff & Suggest Update'}
                </button>
              </div>
              <OutputDisplay content={suggestion} isLoading={isSuggesting} error={suggestError} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


// --- Sample Data for easy testing ---
const sampleFullDocCode = `package com.ifast.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/**
 * Manages client portfolios and investment accounts.
 * Provides endpoints for fetching, creating, and updating portfolio information.
 */
@RestController
@RequestMapping("/api/v2/portfolios")
public class PortfolioController {

    /**
     * Retrieves the portfolio summary for a specific client.
     * @param clientId The unique identifier for the client.
     * @return A summary of the client's portfolio.
     */
    @GetMapping("/{clientId}")
    public ResponseEntity<Map<String, Object>> getPortfolio(@PathVariable String clientId) {
        // Implementation omitted for brevity
        return ResponseEntity.ok(Map.of("clientId", clientId, "totalValue", 250000.75, "currency", "SGD"));
    }

    /**
     * Adds a new investment product to a client's portfolio.
     * @param clientId The client's unique identifier.
     * @param newInvestment A map containing the product ID and amount.
     * @return The updated portfolio details.
     */
    @PostMapping("/{clientId}/investments")
    public ResponseEntity<Map<String, Object>> addInvestment(
        @PathVariable String clientId,
        @RequestBody Map<String, Object> newInvestment) {
        
        // Implementation omitted
        return ResponseEntity.status(201).body(Map.of("status", "success", "investmentId", "inv-98765"));
    }
}
`;

const sampleOriginalCode = `
@RestController
@RequestMapping("/api/v1/trade")
public class TradingController {
    @PostMapping("/execute")
    public TradeResponse executeTrade(@RequestBody TradeRequest trade) {
        // ...
    }
}
`;

const sampleUpdatedCode = `
@RestController
@RequestMapping("/api/v2/trade") // API version updated
public class TradingController {
    
    // New endpoint to get trade status
    @GetMapping("/{tradeId}/status")
    public String getTradeStatus(@PathVariable String tradeId) {
        return "COMPLETED";
    }

    @PostMapping("/execute")
    public TradeResponse executeTrade(
        @RequestBody TradeRequest trade,
        @RequestHeader("X-Client-Id") String clientId // New required header
    ) {
        // ...
    }

    // Old endpoint was removed
    // @PostMapping("/cancel")
    // public void cancelTrade(@RequestParam String tradeId) { ... }
}
`;

