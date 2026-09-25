import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

export const ForgotPasswordPage: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Password reset link sent to registered email.');
  };

  return (
    <div className="py-12 px-4 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold font-heading text-foreground">
          Reset HSM Credentials
        </h1>
        <p className="text-xs text-foreground-muted">
          Enter your registered email to receive a hardware token recovery link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 bg-surface border border-border rounded-2xl space-y-4 text-xs shadow-xs">
        <div>
          <label className="block font-semibold mb-1">Registered Email</label>
          <input type="email" required placeholder="counsel@sharmachambers.in" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <Button variant="primary" type="submit" className="w-full">
          Send Recovery Link
        </Button>
      </form>
    </div>
  );
};
