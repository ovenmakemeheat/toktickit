export default function App() {
  return (
    <main className="container min-vh-100 d-flex align-items-center py-5">
      <section className="card border-0 shadow-sm w-100" aria-labelledby="app-title">
        <div className="card-body p-4 p-md-5">
          <p className="text-uppercase text-primary fw-semibold small mb-2">IT Service Desk</p>
          <h1 id="app-title" className="display-6 fw-bold">
            TokTickIT IT Service Desk
          </h1>
          <p className="lead text-secondary mb-4">
            Lab 1 full-stack foundation is ready for the system check.
          </p>
          <button type="button" className="btn btn-primary">
            Check System
          </button>
        </div>
      </section>
    </main>
  );
}
