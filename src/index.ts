import { StoreApi, create } from "zustand";

/**
 * Extract type of zustand store by retrieving return type of `getState`
 */
type ExtractType<T> = T extends StoreApi<any>
  ? ReturnType<T["getState"]>
  : never;

/**
 * Extract the types of an array of zustand stores
 */
type UnwrapStoreApi<T> = T extends readonly StoreApi<any>[]
  ? T extends [infer Head, ...infer Tail]
    ? readonly [ExtractType<Head>, ...UnwrapStoreApi<Tail>]
    : readonly []
  : never;

/**
 * A zustand store that derives its state from other zustand stores. An internal zustand store is used to facilitate this custom store implementation.
 * @param stores The input stores
 * @param onChange A function thast takes the state of the input stores and returns the derived state.
 * `onChanged` is called whenever any of the input stores change, and when the derived store is first created.
 *
 * @returns
 */
export const derive = <
  T extends any,
  Stores extends readonly StoreApi<any>[],
  DepsState extends UnwrapStoreApi<Stores> = UnwrapStoreApi<Stores>
>(
  stores: Stores,
  onChange: (
    depsState: DepsState,
    prevDepsState: DepsState | null,
    prevState: T | null
  ) => T
): StoreApi<T> => {
  type Listener = (state: T, prevState: T) => void;

  /**
   * The initial states of the input stores
   */
  // @ts-ignore
  const initialDepsState = stores.map((store) => store.getState()) as DepsState;

  const store = create<{
    /**
     * Set of listeners of the derived store
     */
    listeners: Set<Listener>;
    /**
     * The states of the input stores
     */
    depsState: DepsState;
    /**
     * The previous states of the input stores, as a whole, not individually.
     * i.e. The previous state of the states of the input stores.
     */
    prevDepsState: DepsState | null;
    /**
     * The derived state
     */
    state: T;
    /**
     * The previous derived state
     */
    prevState: T | null;
    /**
     * The unsubscribe handlers of the input stores
     */
    depsSubs: (() => void)[];
  }>((set, get) => ({
    listeners: new Set(),
    depsState: initialDepsState,
    prevDepsState: null,
    state: onChange(initialDepsState, null, null),
    prevState: null,
    depsSubs: [],
  }));

  const depsSubs = stores.map((depStore, index) =>
    depStore.subscribe((depState, prevDepState) => {
      const currentDepsState = store.getState().depsState;

      // TODO: use immer but avoid circular trees
      // https://immerjs.github.io/immer/pitfalls/#immer-only-supports-unidirectional-trees
      // depsState = produce(depsState, ($depsState) => {
      //   // @ts-ignore
      //   $depsState[index] = depState;
      // });

      const newDepsState: DepsState = [...currentDepsState];
      // @ts-ignore
      newDepsState[index] = depState;

      const prevState = store.getState().state;

      const newState = onChange(newDepsState, currentDepsState, prevState);

      store.setState({
        prevDepsState: currentDepsState,
        depsState: newDepsState,
        prevState: prevState,
        state: newState,
      });

      store.getState().listeners.forEach((listener) =>
        listener(
          newState,
          prevState ?? newState // Zustand restricts prevState to be !null
        )
      );
    })
  );

  store.setState({ depsSubs });

  return {
    getState: () => store.getState().state,
    subscribe: (listener: Listener) => {
      const newListeners = new Set([...store.getState().listeners, listener]);

      store.setState({
        listeners: newListeners,
      });

      return () => {
        const listeners = store.getState().listeners;
        listeners.delete(listener);
        store.setState({
          listeners: listeners,
        });
      };
    },
    setState: () => {
      throw new Error("setState is not available in derived store");
    },
    // FIX: Handle unsubscribing from input stores when "destroyed" (but destroyed api is deprecated?)
    destroy: () => {
      store.getState().depsSubs.forEach((unsub) => unsub());
    },
  };
};
