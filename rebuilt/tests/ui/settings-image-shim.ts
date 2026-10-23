/** Browser fixture boundary for Next's image loader; application keeps next/image. */
import { createElement, type ComponentProps } from "react";
export default function Image(
  props: ComponentProps<"img"> & { unoptimized?: boolean },
) {
  const fields = { ...props };
  delete fields.unoptimized;
  return createElement("img", fields);
}
