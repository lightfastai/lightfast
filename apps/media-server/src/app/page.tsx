"use client";

export default function Home() {
  console.log(process.env.FAL_KEY);
  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-[family-name:var(--font-geist-sans)] sm:p-20">
      <main className="row-start-2 flex w-full max-w-5xl flex-col items-center gap-[32px] sm:items-start">
        <h1 className="mb-8 text-4xl font-bold">Lightfast Media Server</h1>
        <section className="w-full">
          <h2 className="mb-4 text-2xl font-semibold">Runs</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Run ID</th>
                  <th className="px-4 py-2 font-semibold">Engine</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Queued at</th>
                  <th className="px-4 py-2 font-semibold">Resource</th>
                </tr>
              </thead>
              {/* <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-neutral-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : resources.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-neutral-400"
                    >
                      No runs found.
                    </td>
                  </tr>
                ) : (
                  resources.map((resource) => (
                    <tr
                      key={resource.id}
                      className="border-t border-neutral-800 transition-colors hover:bg-neutral-900"
                    >
                      <td className="px-4 py-2">{resource.status}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {resource.id}
                      </td>
                      <td className="px-4 py-2">{resource.engine}</td>
                      <td className="px-4 py-2">{resource.type}</td>
                      <td className="px-4 py-2">
                        {resource.external_request_id ?? (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {resource.type === "image" && resource.url ? (
                          <img
                            src={resource.url}
                            alt="Resource"
                            className="h-12 rounded shadow"
                          />
                        ) : resource.type === "video" && resource.url ? (
                          <video
                            src={resource.url}
                            className="h-12 rounded shadow"
                            controls
                          />
                        ) : resource.type === "text" && resource.data ? (
                          <span className="whitespace-pre-wrap">
                            {String(resource.data)}
                          </span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody> */}
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
