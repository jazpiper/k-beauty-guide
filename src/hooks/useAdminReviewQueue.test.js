import { renderHook, act } from "@testing-library/react";
import {
  useAdminReviewQueue,
  INITIAL_QUEUE,
  STATUS_META,
} from "./useAdminReviewQueue";

describe("useAdminReviewQueue", () => {
  it("initializes with default queue and first item selected", () => {
    const { result } = renderHook(() => useAdminReviewQueue());

    expect(result.current.queue).toEqual(INITIAL_QUEUE);
    expect(result.current.selectedId).toBe(INITIAL_QUEUE[0].id);
    expect(result.current.selectedItem).toEqual(INITIAL_QUEUE[0]);
    expect(result.current.selectedStatusMeta).toEqual(
      STATUS_META[INITIAL_QUEUE[0].status],
    );
  });

  it("allows selecting a different item", () => {
    const { result } = renderHook(() => useAdminReviewQueue());

    act(() => {
      result.current.setSelectedId(INITIAL_QUEUE[1].id);
    });

    expect(result.current.selectedId).toBe(INITIAL_QUEUE[1].id);
    expect(result.current.selectedItem).toEqual(INITIAL_QUEUE[1]);
    expect(result.current.selectedStatusMeta).toEqual(
      STATUS_META[INITIAL_QUEUE[1].status],
    );
  });

  it("updates status and notes for the selected item", () => {
    const { result } = renderHook(() => useAdminReviewQueue());

    act(() => {
      result.current.updateStatus("approved");
    });

    expect(result.current.selectedItem.status).toBe("approved");
    expect(result.current.selectedItem.notes).toBe(
      "Approved in shell state. Backend wiring pending.",
    );

    act(() => {
      result.current.updateStatus("rejected");
    });

    expect(result.current.selectedItem.status).toBe("rejected");
    expect(result.current.selectedItem.notes).toBe(
      "Rejected in shell state. Backend wiring pending.",
    );

    act(() => {
      result.current.updateStatus("needs-info");
    });

    expect(result.current.selectedItem.status).toBe("needs-info");
    expect(result.current.selectedItem.notes).toBe(
      "Marked needs-info in shell state. Backend wiring pending.",
    );
  });

  it("handles empty initial queue gracefully", () => {
    const { result } = renderHook(() => useAdminReviewQueue([]));

    expect(result.current.queue).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.selectedStatusMeta).toBeNull();
  });
});
