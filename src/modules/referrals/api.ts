import { db, auth } from "@/firebase/client";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";

export async function generateReferralCode(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  // Generar código único
  const code = user.uid.substring(0, 8).toUpperCase();

  // Guardar en Firestore
  await updateDoc(doc(db, "users", user.uid), {
    referralCode: code,
  });

  return code;
}

export async function getReferrals(userId: string) {
  const q = query(
    collection(db, "referrals"),
    where("referrerId", "==", userId),
    orderBy("signupDate", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
