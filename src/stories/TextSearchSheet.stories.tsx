import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { TextSearchSheet } from "../components/TextSearchSheet";

interface Person {
  id: string;
  name: string;
}

const PEOPLE: Person[] = [
  { id: "p1", name: "אורית שמש" },
  { id: "p2", name: "מירב אלון" },
  { id: "p3", name: "Dana Levi" },
  { id: "p4", name: "עידו כץ" },
];

const Demo = () => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <TextSearchSheet<Person>
      mode="pick"
      items={PEOPLE}
      getText={p => p.name}
      getKey={p => p.id}
      value={value}
      onSelect={p => setValue(p?.id)}
      placeholder="בחר תלמיד/ה"
    />
  );
};

const meta: Meta<typeof Demo> = {
  title: "Components/TextSearchSheet",
  component: Demo,
  parameters: { layout: "padded", viewport: { defaultViewport: "mobile1" } },
};
export default meta;

export const Default: StoryObj<typeof Demo> = {};
