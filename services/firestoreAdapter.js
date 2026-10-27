import { collection, doc, getDoc, setDoc, updateDoc, addDoc, runTransaction } from 'firebase/firestore';

// The payment core (paymentCore.js) was written against the server-side Firestore API
// (db.collection('x').doc('y').get() ...). This wraps the app's Firestore client in the same shape,
// so exactly the same code can run on the phone.
export function adminLikeDb(db) {
  const snapshot = (snap) => ({ exists: snap.exists(), id: snap.id, data: () => snap.data() });

  const docRef = (path) => {
    const ref = doc(db, ...path);
    return {
      _ref: ref,
      id: path[path.length - 1],
      get: async () => snapshot(await getDoc(ref)),
      set: (data, options) => (options && options.merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data)),
      update: (patch) => updateDoc(ref, patch),
      collection: (name) => collectionRef([...path, name]),
    };
  };

  const collectionRef = (path) => ({
    doc: (id) => docRef([...path, id]),
    add: async (data) => {
      const created = await addDoc(collection(db, ...path), data);
      return { id: created.id };
    },
  });

  return {
    collection: (name) => collectionRef([name]),
    runTransaction: (fn) =>
      runTransaction(db, (tx) =>
        fn({
          get: async (ref) => snapshot(await tx.get(ref._ref)),
          update: (ref, patch) => tx.update(ref._ref, patch),
          set: (ref, data, options) =>
            options && options.merge ? tx.set(ref._ref, data, { merge: true }) : tx.set(ref._ref, data),
        })
      ),
  };
}
