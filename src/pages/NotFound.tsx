import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        fontFamily: 'sans-serif',
      }}
    >
      <p
        style={{
          fontSize: '96px',
          fontWeight: '900',
          color: '#00ff00',
          margin: '0 0 8px',
          lineHeight: 1,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: '700',
          margin: '0 0 12px',
          color: '#1a1a1a',
        }}
      >
        Page Not Found
      </h1>
      <p style={{ color: '#555', maxWidth: '380px', marginBottom: '32px' }}>
        The page you're looking for doesn't exist. It may have been moved or the
        link is incorrect.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/"
          style={{
            background: '#000',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: '8px',
            fontWeight: 'bold',
            textDecoration: 'none',
            fontSize: '15px',
          }}
        >
          Go Home
        </Link>
        <Link
          to="/get-quote"
          style={{
            background: '#00ff00',
            color: '#000',
            padding: '12px 28px',
            borderRadius: '8px',
            fontWeight: 'bold',
            textDecoration: 'none',
            fontSize: '15px',
          }}
        >
          Request Delivery
        </Link>
      </div>
    </div>
  );
}
