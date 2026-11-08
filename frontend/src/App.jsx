import Login from "./pages/Login";
import { useState, useEffect } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const statusStyles = {
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-amber-50 text-amber-700",
  "Under Review": "bg-violet-50 text-violet-700",
  Resolved: "bg-emerald-50 text-emerald-700",
};

const priorityStyles = {
  Urgent: "text-red-700",
  High: "text-orange-700",
  Medium: "text-amber-700",
  Low: "text-slate-500",
};

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [formData, setFormData] = useState({
  title: "",
  location: "",
  categoryId: "",
  priority: "MEDIUM",
  description: "",
});

const [categories, setCategories] = useState([]);
const [submitting, setSubmitting] = useState(false);
const [formMessage, setFormMessage] = useState("");
const [formError, setFormError] = useState("");
const [summary, setSummary] = useState({
  totalRequests: 0,
  awaitingReview: 0,
  inProgress: 0,
  resolved: 0,
});

const [officers, setOfficers] = useState([]);
const [assigningRequestId, setAssigningRequestId] = useState("");
const [assignmentMessage, setAssignmentMessage] = useState("");
const [officerRequests, setOfficerRequests] = useState([]);
const [officerRequestsLoading, setOfficerRequestsLoading] = useState(false);
const [officerRequestsError, setOfficerRequestsError] = useState("");
const [updatingRequestId, setUpdatingRequestId] = useState("");
const [officerMessage, setOfficerMessage] = useState("");
const [requestHistory, setRequestHistory] = useState({});
const [historyLoading, setHistoryLoading] = useState({});
const [historyErrors, setHistoryErrors] = useState({});
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState("");
const [priorityFilter, setPriorityFilter] = useState("");
const [categoryFilter, setCategoryFilter] = useState("");

useEffect(() => {
  if (user?.role !== "ADMIN") {
    setOfficers([]);
    return;
  }

  async function fetchOfficers() {
    try {
      const response = await fetch(
        `${API_URL}/api/requests/officers`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Unable to load maintenance officers.");
      }

      const data = await response.json();
      setOfficers(data.officers);
    } catch (error) {
      console.error("Failed to fetch officers:", error);
      setAssignmentMessage(error.message);
    }
  }

  fetchOfficers();
}, [user]);

useEffect(() => {
  if (user?.role !== "MAINTENANCE_OFFICER") return;

  const fetchOfficerRequests = async () => {
    setOfficerRequestsLoading(true);
    setOfficerRequestsError("");

    try {
      const response = await fetch(
        `${API_URL}/api/requests/assigned`,
        {
          credentials: "include",
            }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load assigned requests.");
      }

      setOfficerRequests(data.requests || []);
    } catch (error) {
      setOfficerRequestsError(error.message);
    } finally {
      setOfficerRequestsLoading(false);
    }
  };

  fetchOfficerRequests();
}, [user]);

useEffect(() => {
  if (!user) {
    setCategories([]);
    return;
  }

  async function fetchCategories() {
    try {
      const response = await fetch(
        `${API_URL}/api/requests/categories`,
        { credentials: "include" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load categories.");
      }

      setCategories(data.categories || []);
    } catch (error) {
      console.error("Category loading failed:", error);
    }
  }

  fetchCategories();
}, [user]);

useEffect(() => {
  async function checkSession() {
     try {
          const response = await fetch(
            `${API_URL}/api/auth/me`,
            {
              credentials: "include",
            }
          );

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            console.log("Logged-in user:", data.user);
            console.log("User role:", data.user?.role);
          }
        } catch (error) {
          console.error("Session check failed:", error);
        } finally {
          setCheckingSession(false);
        }
      }

      checkSession();
    }, []);


useEffect(() => {
  if (!user) return;

  async function fetchRequests() {
    setRequestsLoading(true);
    setRequestsError("");

    try {
      const params = new URLSearchParams();

      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (statusFilter) params.append("status", statusFilter);
      if (priorityFilter) params.append("priority", priorityFilter);
      if (categoryFilter) params.append("categoryId", categoryFilter);

      const queryString = params.toString();

      const response = await fetch(
        `${API_URL}/api/requests${queryString ? `?${queryString}` : ""}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load maintenance requests."
        );
      }

      const formattedRequests = (data.requests || []).map((request) => ({
        id: request.id,
        title: request.title,
        location: request.location,
        category: request.category?.name || "Uncategorized",
        priority: formatLabel(request.priority),
        status: formatLabel(request.currentStatus),
        date: new Date(request.submittedAt).toLocaleDateString(
          "en-GB",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        ),
      }));

      setRequests(formattedRequests);
      setSummary(
        data.summary || {
          totalRequests: formattedRequests.length,
          awaitingReview: formattedRequests.filter(
            (request) => request.status === "Under Review"
          ).length,
          inProgress: formattedRequests.filter(
            (request) => request.status === "In Progress"
          ).length,
          resolved: formattedRequests.filter(
            (request) => request.status === "Resolved"
          ).length,
        }
      );
    } catch (error) {
      setRequestsError(error.message);
    } finally {
      setRequestsLoading(false);
    }
  }

  fetchRequests();
}, [user, searchTerm, statusFilter, priorityFilter, categoryFilter]);


async function handleSubmitRequest(event) {
  event.preventDefault();

  setSubmitting(true);
  setFormMessage("");
  setFormError("");

  try {
    const response = await fetch(
      `${API_URL}/api/requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to submit request.");
    }

    setFormMessage("Maintenance request submitted successfully!");

    setFormData({
      title: "",
      location: "",
      categoryId: "",
      priority: "MEDIUM",
      description: "",
    });

    // Refresh requests from the database
    const requestsResponse = await fetch(
      `${API_URL}/api/requests`,
      { credentials: "include" }
    );

    const requestsData = await requestsResponse.json();

    if (requestsResponse.ok) {
      const formattedRequests = (requestsData.requests || []).map(
        (request) => ({
          id: request.id,
          title: request.title,
          location: request.location,
           category: request.category?.name || "Uncategorized",
          priority: formatLabel(request.priority),
          status: formatLabel(request.currentStatus),
          date: new Date(request.submittedAt).toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }
          ),
        })
      );

      setRequests(formattedRequests);
    }
  } catch (error) {
    setFormError(error.message);
  } finally {
    setSubmitting(false);
  }
}


if (checkingSession) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-slate-600">Checking your session...</p>
    </div>
  );
}

  if (showLogin && !user) {
    return <Login onLogin={setUser} />;
  }

  
async function handleAssignOfficer(requestId, officerId) {
  if (!officerId) {
    setAssignmentMessage("Please select a maintenance officer.");
    return;
  }

  setAssigningRequestId(requestId);
  setAssignmentMessage("");

  try {
    const response = await fetch(
      `${API_URL}/api/requests/${requestId}/assign`,
      {
         method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          assignedToId: officerId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to assign request.");
    }

    setAssignmentMessage("Maintenance request assigned successfully.");

    const requestsResponse = await fetch(
      `${API_URL}/api/requests`,
      { credentials: "include" }
    );

    if (requestsResponse.ok) {
      const requestsData = await requestsResponse.json();
      setRequests(
        requestsData.requests.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category?.name || "Uncategorised",
          priority: item.priority,
          status: item.currentStatus,
          date: new Date(item.submittedAt).toLocaleDateString(),
          location: item.location,
        }))
      );
      setSummary(requestsData.summary);
    }
  } catch (error) {
    setAssignmentMessage(error.message);
  } finally {
    setAssigningRequestId("");
  }
}

const handleOfficerStatusUpdate = async (requestId, status) => {
  const note = document
    .getElementById(`note-${requestId}`)
    ?.value.trim();
    
    if (!note || note.length < 3) {
    setOfficerMessage("Please enter a progress note (at least 3 characters).");
    return;
  }

  setUpdatingRequestId(requestId);
  setOfficerMessage("");

  try {
    const response = await fetch(
      `${API_URL}/api/requests/${requestId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status, note }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update request status.");
    }

    setOfficerMessage(data.message);

    const refreshResponse = await fetch(
      `${API_URL}/api/requests/assigned`,
      {
        credentials: "include",
      }
    );

    const refreshedData = await refreshResponse.json();

    if (!refreshResponse.ok) {
      throw new Error(
        refreshedData.message || "Status updated, but refreshing requests failed."
      );
    }

    setOfficerRequests(refreshedData.requests || []);
  } catch (error) {
    setOfficerMessage(error.message);
  } finally {
    setUpdatingRequestId("");
     }
};


const fetchRequestHistory = async (requestId) => {
  setHistoryLoading((prev) => ({
    ...prev,
    [requestId]: true,
  }));

  setHistoryErrors((prev) => ({
    ...prev,
    [requestId]: "",
  }));

  try {
    const response = await fetch(
      `${API_URL}/api/requests/${requestId}/history`,
      {
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to load request history."
      );
    }

    setRequestHistory((prev) => ({
      ...prev,
      [requestId]: data.history || [],
    }));
  } catch (error) {
    setHistoryErrors((prev) => ({
      ...prev,
      [requestId]: error.message,
    }));
  } finally {
    setHistoryLoading((prev) => ({
      ...prev,
      [requestId]: false,
    }));
  }
};


async function handleLogout() {
  try {
    const response = await fetch(
      `${API_URL}/api/auth/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to log out. Please try again.");
    }

    setUser(null);
    setRequests([]);
    setOfficers([]);
    setShowLogin(true);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-6 md:flex md:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white">
              M
            </div>
            <div>
              <h1 className="font-bold text-slate-900">MaintainCare</h1>
              <p className="text-xs text-slate-500">
              {user?.role === "ADMIN"
                ? "Administration"
                : user?.role === "MAINTENANCE_OFFICER"
                  ? "Maintenance Workspace"
                  : user?.role === "STAFF"
                    ? "Staff Workspace"
                    : "University Services"}
              </p>
            </div>
          </div>

          <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <nav className="space-y-2">
             <a
              href="#dashboard"
              className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 font-medium text-blue-700"
            >
              <span>▦</span> Dashboard
            </a>
            <a
              href="#requests"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100"
            >
              <span>▤</span> Maintenance Requests
            </a>
            <a
              href="#categories"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-100"
            >
              <span>◈</span> Categories
            </a>
          </nav>

          
              <button
                type="button"
                onClick={handleLogout}
                className="mb-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-red-600 hover:bg-red-50"
              >
                <span>↪</span>
                Logout
              </button>

          
            <div className="mt-auto rounded-2xl bg-slate-50 p-4">
              {user?.role === "STUDENT" || user?.role === "STAFF" ? (
                <>
                  <p className="font-semibold text-slate-800">Need assistance?</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Track a problem or submit a new maintenance request.
                  </p>
                  <a
                    href="#new-request"
                    className="mt-4 block rounded-lg bg-blue-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Create request
                  </a>
                </>
              ) : user?.role === "ADMIN" ? (
                <>
                  <p className="font-semibold text-slate-800">Administration</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Review requests and assign maintenance officers.
                     </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-800">Maintenance team</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage and update your assigned maintenance requests.
                  </p>
                </>
              )}
            </div>

        </aside>

        <main id="dashboard" className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div>
              <p className="text-sm text-slate-500">University Services Portal</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Maintenance Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline">
                {user?.role === "ADMIN"
                  ? "Administration Portal"
                  : user?.role === "MAINTENANCE_OFFICER"
                  ? "Maintenance Officer Portal"
                  : user?.role === "STAFF"
                  ? "Staff Portal"
                  : "Student Portal"}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                ST
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-slate-500">Tuesday, 27 October 2026</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  Welcome back!
                </h3>
                <p className="mt-1 text-slate-500">
                  Here's an overview of your maintenance activity.
                </p>
              </div>
              
              <a
                id="new-request"
                href="#request-form"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-medium text-white shadow-sm hover:bg-blue-800"
              >
                <span className="text-xl">+</span> New request
              </a>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
             <SummaryCard
                  label="Total requests"
                  value={summary?.totalRequests ?? 0}
                  note="All submitted requests"
                  symbol="▤"
                  color="blue"
                />
              <SummaryCard
                label="Awaiting review"
                value={summary?.awaitingReview ?? 0}
                note="Needs initial review"
                symbol="◷"
                color="amber"
              />
              <SummaryCard
                label="In progress"
                value={summary?.inProgress ?? 0}
                note="Currently being handled"
                symbol="⚙"
                color="violet"
              />
              <SummaryCard
                label="Resolved"
                value={summary?.resolved ?? 0}
                note="Successfully completed"
                symbol="✓"
                color="green"
              />
            </section>
                  {user?.role === "MAINTENANCE_OFFICER" && (
  <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-gray-800">
        My Assigned Requests
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        View and manage maintenance tasks assigned to you.
      </p>
    </div>
      
      {officerRequestsLoading ? (
          <p className="text-gray-500">Loading assigned requests...</p>
        ) : officerRequestsError ? (
          <p className="text-red-600">{officerRequestsError}</p>
        ) : officerRequests.length === 0 ? (
          <p className="text-gray-500">
            You don't have any maintenance requests assigned yet.
          </p>
        ) : (
          <div className="space-y-4">
            {officerRequests.map((request) => (
          
            <div
              key={request.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <h3 className="font-semibold text-gray-800">
                {request.title}
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Category: {request.category?.name || "Uncategorised"}
              </p>

              <p className="text-sm text-gray-600">
                Location: {request.location}
              </p>

              <p className="text-sm text-gray-600">
                Priority: {request.priority}
              </p>

              <p className="text-sm text-gray-600">
                Status: {request.currentStatus}
              </p>

              <p className="text-sm text-gray-600">
                Submitted by: {request.submittedBy?.fullName}
              </p>

              {request.currentStatus !== "RESOLVED" && (
                <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                  <label
                    htmlFor={`note-${request.id}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Progress Note
                  </label>

                    <textarea
                    id={`note-${request.id}`}
                    rows="3"
                    placeholder="Describe the work completed or progress made..."
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  />

                  <div className="flex flex-wrap gap-3">
                    {request.currentStatus === "ASSIGNED" && (
                      <button
                        type="button"
                        disabled={updatingRequestId === request.id}
                        onClick={() =>
                          handleOfficerStatusUpdate(request.id, "IN_PROGRESS")
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingRequestId === request.id
                          ? "Updating..."
                          : "Start Task"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={updatingRequestId === request.id}
                      onClick={() =>
                        handleOfficerStatusUpdate(request.id, "RESOLVED")
                      }
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingRequestId === request.id
                        ? "Updating..."
                        : "Mark as Resolved"}
                    </button>
                  </div>

                  {officerMessage && (
                    <p
                      role="status"
                      className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700"
                    >
                      {officerMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            ))}
             </div>
        )}
      </section>
    )}
            <section
              id="requests"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Recent maintenance requests
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Review and track reported issues.
                  </p>
                </div>
                <div className="border-b border-slate-200 p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search request title..."
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">All statuses</option>
                      <option value="SUBMITTED">Submitted</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CLOSED">Closed</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">All priorities</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                       <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("");
                        setPriorityFilter("");
                        setCategoryFilter("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Clear all filters
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  View all requests
                </button>
              </div>

              
              {assignmentMessage && (
                <div
                  className={`mx-6 my-3 rounded-lg px-4 py-3 text-sm font-medium ${
                    assignmentMessage.toLowerCase().includes("successfully")
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                     {assignmentMessage}
                </div>
              )}


              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Request</th>
                      <th className="px-6 py-4 font-semibold">Category</th>
                      <th className="px-6 py-4 font-semibold">Priority</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      
                      <th className="px-6 py-4 font-semibold">Date</th>
                      {user?.role === "ADMIN" && (
                        <th className="px-6 py-4 font-semibold">Assign Officer</th>
                      )}

                    </tr>
                  </thead>
                 
                  <tbody className="divide-y divide-slate-100">
                    {requestsLoading ? (
                      <tr>
                        <td colSpan={user?.role === "ADMIN" ? 6 : 5} className="px-6 py-10 text-center text-slate-500">
                          Loading maintenance requests...
                        </td>
                      </tr>
                    ) : requestsError ? (
                      <tr>
                        <td colSpan={user?.role === "ADMIN" ? 6 : 5} className="px-6 py-10 text-center text-red-600">
                          {requestsError}
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={user?.role === "ADMIN" ? 6 : 5} className="px-6 py-10 text-center text-slate-500">
                          No maintenance requests yet. Submit a request to get started.
                        </td>
                      </tr>
                    ) : (
                      requests.map((request) => (
                        <tr key={request.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">
                              {request.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {request.id} · {request.location}
                            </p>

                             <button
                            type="button"
                            onClick={() => fetchRequestHistory(request.id)}
                            className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
                          >
                            View Request History
                          </button>

                          {historyLoading[request.id] && (
                            <p className="mt-2 text-xs text-slate-500">
                              Loading history...
                            </p>
                          )}

                          {historyErrors[request.id] && (
                            <p className="mt-2 text-xs text-red-600">
                              {historyErrors[request.id]}
                            </p>
                          )}

                          {requestHistory[request.id] && (
                            <div className="mt-3 space-y-3 border-l-2 border-blue-200 pl-3">
                              {requestHistory[request.id].length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No activity history available yet.
                                </p>
                              ) : (
                                requestHistory[request.id].map((activity) => (
                                  <div key={activity.id}>
                                    <p className="text-xs font-semibold text-slate-700">
                                      {activity.newStatus.replaceAll("_", " ")}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-600">
                                      {activity.note}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                      By {activity.changedBy?.fullName || "Unknown user"}
                                      {" · "}
                                      {new Date(activity.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                            </td>

                          <td className="px-6 py-4 text-slate-600">
                            {request.category}
                          </td>

                          <td className="px-6 py-4">
                            <span className={`font-medium ${priorityStyles[request.priority] || "text-slate-500"}`}>
                              {request.priority}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${statusStyles[request.status] || "bg-slate-100 text-slate-700"}`}>
                              {request.status}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                            {request.date}
                          </td>
                          
                          
                      {user?.role === "ADMIN" && (
                        <td className="px-6 py-4">
                          <div className="flex min-w-52 flex-col gap-2">
                            <select
                              id={`officer-${request.id}`}
                              defaultValue=""
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                            >
                              <option value="">Select officer</option>
                              {officers.map((officer) => (
                                <option key={officer.id} value={officer.id}>
                                  {officer.fullName}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={assigningRequestId === request.id || officers.length === 0}
                              onClick={() => {
                                const select = document.getElementById(
                                  `officer-${request.id}`
                                );
                                handleAssignOfficer(request.id, select?.value);
                              }}
                              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                               {assigningRequestId === request.id ? "Assigning..." : "Assign"}
                            </button>
                          </div>
                        </td>
                      )}

                        </tr>
                      ))
                    )}
                  </tbody>
                    
                </table>
              </div>

              <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
                Showing {requests.length} maintenance requests
              </div>
            </section>

            <form onSubmit={handleSubmitRequest}>
            <section
              id="request-form"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Submit a maintenance request
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Report an issue so the appropriate team can address it.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Request title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) =>
                      setFormData({ ...formData, title: event.target.value })
                    }
                    placeholder="e.g. Faulty ceiling fan"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    
                  />
                </div>
                <div>
                   <label className="mb-2 block text-sm font-medium">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(event) =>
                      setFormData({ ...formData, location: event.target.value })
                    }
                    placeholder="e.g. Block A, Room 204"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Category
                  </label>
                  <select
                  value={formData.categoryId}
                  onChange={(event) =>
                    setFormData({ ...formData, categoryId: event.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Priority
                  </label>
                  <select value={formData.priority}
                    onChange={(event) =>
                      setFormData({ ...formData, priority: event.target.value })
                    } className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500">
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">
                    Description
                     </label>
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData({ ...formData, description: event.target.value })
                    }
                    rows="4"
                    placeholder="Describe the issue and any relevant details..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              {formMessage && (
                  <p role="status" className="mt-4 text-sm text-emerald-700">
                    {formMessage}
                  </p>
                )}

                {formError && (
                  <p role="alert" className="mt-4 text-sm text-red-700">
                    {formError}
                  </p>
                )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </section>
            </form>


            <footer className="pb-3 text-center text-sm text-slate-400">
              Maintenance Support · University Services
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
function formatLabel(value) {
  if (!value) return "Unknown";

  return value
   .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function SummaryCard({ label, value, note, symbol, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${colors[color]}`}
        >
          {symbol}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

export default App;
