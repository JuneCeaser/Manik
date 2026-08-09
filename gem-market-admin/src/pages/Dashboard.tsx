import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type User = {
  _id: string;
  name: string;
  phone: string;
  profileImage?: string;
  createdAt: string;
};

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const res = await fetch('http://localhost:5000/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.success) {
          setUsers(data.users);
        } else {
          setError(data.message || 'Failed to load users');
          if (res.status === 401) navigate('/login');
        }
      } catch {
        setError('Failed to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [navigate]);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}?`)) return;

    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setUsers(users.filter((user) => user._id !== userId));
      } else {
        alert(data.message || 'Failed to delete user');
      }
    } catch {
      alert('Failed to connect to the server.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold" style={{ color: '#0f172a' }}>Manik Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total App Users</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: '#0f172a' }}>{users.length}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold" style={{ color: '#0f172a' }}>Registered Users</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading users...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No users found in the database.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 flex items-center space-x-3">
                        {user.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold" style={{ color: '#0f172a' }}>{user.name}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">+{user.phone}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user._id, user.name)}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}