import React, { useEffect, useState } from "react";
import axios from "axios";

export default function App() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(
        `${import.meta.env.VITE_BASE_API}/mainnet/activity?wallet_address=${
          import.meta.env.VITE_WALLET_ADDRESS
        }&network=Solana`,
      )
      .then((response) => {
        setActivities(response.data.data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="bg-neutral-100 min-h-screen p-5">
      <div className="rounded-2xl shadow-m bg-neutral-50 p-4 md:p-6 lg h-full">
        <h1 className="text-3xl font-bold underline">Solana Wallet Activity By Utkarsh Kushwaha</h1>
        {activities.map((activity) => (
          <div key={activity.uuid} className="activity-card my-10 border p-4 rounded-xl">
            <h2>Transaction Type: {activity.type}</h2>
            <p>
              Transaction Hash:
              <a href={activity.explorer_url} target="_blank" rel="noopener noreferrer">
                {activity.transaction_hash}
              </a>
            </p>
            <p>Network: {activity.network}</p>
            <p>Fee: {activity.fee}</p>
            <p>Compute Units Consumed: {activity.compute_units_consumed}</p>
            <p>Timestamp: {new Date(activity.timestamp).toLocaleString()}</p>
            <p>Amount: {activity.metadata.amount}</p>
            <div className="mt-5">
              <h3 className="text-lg font-bold mb-2">Token Info:</h3>
              <p>Name: {activity.token.name || "NA"}</p>
              <p>Symbol: {activity.token.symbol || "NA"}</p>
              <p>Decimals: {activity.token.decimals || "NA"}</p>
              {activity.token.logo_url && (
                <>
                  <p>Icon:</p>
                  <img src={activity.token.logo_url} alt={activity.token.symbol} width="50" className="rounded-lg" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
