import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';
import { registerAccount, requestPasswordReset, resetPassword, signIn } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  registerAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signIn: vi.fn(),
}));

describe('LoginScreen account flows', () => {
  beforeEach(() => {
    vi.mocked(registerAccount).mockResolvedValue({ message: 'Cuenta creada correctamente.' });
    vi.mocked(requestPasswordReset).mockResolvedValue({ message: 'Si el email está registrado, recibirás un enlace.' });
    vi.mocked(resetPassword).mockResolvedValue(null);
    vi.mocked(signIn).mockResolvedValue(null);
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.clearAllMocks();
  });

  it('creates an account with the entered email and password', async () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'una-clave-segura-123' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => expect(registerAccount).toHaveBeenCalledWith('nuevo@example.com', 'una-clave-segura-123'));
  });

  it('requests a recovery email without disclosing whether the email exists', async () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Olvidé mi contraseña' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'cliente@example.com' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('cliente@example.com'));
    expect(await screen.findByRole('status')).toHaveTextContent('Si el email está registrado');
  });

  it('submits the token and matching new password from a reset link', async () => {
    window.history.replaceState({}, '', '/?reset=single-use-token');
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'otra-clave-segura-456' } });
    fireEvent.change(screen.getByLabelText('Repetir contraseña nueva'), { target: { value: 'otra-clave-segura-456' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('otra-clave-segura-456'));
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada');
  });
});
