import { Suspense, use } from "react";

const fetchData = async () => {
  const data = await fetch("/api/health");
  return data.json<{ message: string }>();
};

const Component = ({ promise }: { promise: Promise<{ message: string }> }) => {
  const data = use(promise);
  console.log(data);
  return <h2 className="text-2xl">{data.message}</h2>;
};

const App = () => {
  return (
    <Suspense fallback={"loading..."}>
      <Component promise={fetchData()} />
    </Suspense>
  );
};

export default App;
