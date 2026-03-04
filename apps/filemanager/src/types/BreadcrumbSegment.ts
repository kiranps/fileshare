import type { JSX } from "react/jsx-runtime";

export type BreadcrumbSegment = {
  label: string;
  path: string[];
  icon?: JSX.Element;
};
