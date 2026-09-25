import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowRight, User, Briefcase, Scale } from 'lucide-react';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="w-3.5 h-3.5" />,
  lawyer: <Briefcase className="w-3.5 h-3.5" />,
  judge: <Scale className="w-3.5 h-3.5" />,
};

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedRole = searchParams.get('role');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Registration submitted for Bar Association verification.');
    navigate(selectedRole ? `/login?role=${selectedRole}` : '/login');
  };

  return (
    <div className="py-12 px-4 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#0B0B0B] dark:bg-[#F3F3F2] text-white dark:text-[#111111] flex items-center justify-center mx-auto shadow-md">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold font-heading text-foreground">
          Create your account
        </h1>
        {selectedRole && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold">
            {ROLE_ICONS[selectedRole]}
            Role: {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
          </div>
        )}
        {!selectedRole && (
          <p className="text-xs text-foreground-muted">
            Verified Advocate or Litigant Account Creation
          </p>
        )}
      </div>

      <form onSubmit={handleRegister} className="p-6 bg-surface border border-border rounded-2xl space-y-4 text-xs shadow-xs">
        <div>
          <label className="block font-semibold mb-1">Full Name</label>
          <input type="text" required placeholder="Adv. Ananya Roy" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <div>
          <label className="block font-semibold mb-1">Bar Council Enrollment Number</label>
          <input type="text" required placeholder="D/1829/2018" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <div>
          <label className="block font-semibold mb-1">Official Email</label>
          <input type="email" required placeholder="ananya@barcouncil.in" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <div>
          <label className="block font-semibold mb-1">Password</label>
          <input type="password" required placeholder="Create a secure password" className="w-full p-2.5 rounded-lg bg-surface-subtle border border-border" />
        </div>

        <Button variant="primary" type="submit" className="w-full" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
          Sign Up
        </Button>

        <p className="text-center text-[11px] text-foreground-muted">
          <Link to={selectedRole ? `/login?role=${selectedRole}` : '/login'} className="text-foreground-muted hover:text-foreground">
            Already have an account? <span className="underline">Log In</span>
          </Link>
        </p>
      </form>

      <div className="text-center">
        <Link to="/role-selection" className="text-xs text-foreground-muted hover:text-foreground inline-flex items-center gap-1.5">
          Choose another role
        </Link>
      </div>

      <div className="text-center">
        <Link to="/" className="text-xs text-foreground-muted hover:text-foreground underline">
          Back to home
        </Link>
      </div>
    </div>
  );
};
