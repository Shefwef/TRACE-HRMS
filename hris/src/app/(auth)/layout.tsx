import AuthBrandSide from './_bg/AuthBrandSide';
import './auth.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <AuthBrandSide />
      <div className="auth-right">
        <div className="auth-mobile-brand">
          <img src="/TRACE%20HRMS%20Transparent.png" alt="TRACE HRMS" />
        </div>
        <div className="auth-form-wrap">{children}</div>
      </div>
    </div>
  );
}
