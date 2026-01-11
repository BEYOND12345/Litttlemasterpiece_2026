
import React, { useState } from 'react';
import { Button } from './Button';
import { User } from '../types/types';
import { signIn, signUp } from '../services/authService';
import { supabase } from '../services/supabaseClient';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isLogin && !name) return;

    setIsLoading(true);
    setError('');

    try {
      let user: User;

      if (isLogin) {
        console.log('🔐 Signing in...');
        user = await signIn(email, password);
        console.log('✅ Sign in successful:', user.email);
      } else {
        console.log('🔐 Signing up...');
        user = await signUp(email, password, name);
        console.log('✅ Sign up successful:', user.email);
      }

      // Small delay to ensure session is written to localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify session is available
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📊 Session after login:', session ? 'exists' : 'null');

      onLogin(user);
    } catch (err: any) {
      console.error('❌ Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-stone-50 px-4">
      <div className="bg-white p-8 md:p-12 shadow-xl border border-stone-100 max-w-md w-full rounded-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl text-stone-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-stone-500 font-light">
            {isLogin ? 'Enter your details to access your collection.' : 'Join to save your masterpieces forever.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-900">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-b border-stone-200 py-2 outline-none focus:border-terracotta transition-colors placeholder-stone-300"
                placeholder="Your full name"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-900">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-b border-stone-200 py-2 outline-none focus:border-terracotta transition-colors placeholder-stone-300"
              placeholder="parent@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-900">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-b border-stone-200 py-2 outline-none focus:border-terracotta transition-colors placeholder-stone-300"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-stone-500 hover:text-stone-900 underline underline-offset-4"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
