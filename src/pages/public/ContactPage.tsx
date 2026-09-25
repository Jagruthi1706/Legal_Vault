import React from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

export const ContactPage: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Your message has been dispatched to the Supreme Court Registry Desk.');
  };

  return (
    <div className="py-12 px-4 md:px-8 max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold font-heading text-foreground">
          Registry Contact & Technical Support
        </h1>
        <p className="text-xs text-foreground-muted">
          Direct inquiry channel for Bar Associations, High Court Registries, and Judicial Officers
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 bg-surface border border-border rounded-xl space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Full Name</label>
            <input type="text" required placeholder="Adv. Rajesh Sharma" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Official Email</label>
            <input type="email" required placeholder="counsel@sharmachambers.in" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Inquiry Message</label>
          <textarea rows={4} required placeholder="Describe your inquiry..." className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <Button variant="primary" type="submit" rightIcon={<Send className="w-3.5 h-3.5" />}>
          Submit Inquiry to Registry
        </Button>
      </form>
    </div>
  );
};
