import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { TextSearch } from "../components/TextSearch";
import { filterByText } from "../utils/textSearch";

interface Person {
  id: string;
  name: string;
  teaches: boolean;
}

const PEOPLE: Person[] = [
  { id: "p1", name: "אורית שמש", teaches: true },
  { id: "p2", name: "מירב אלון", teaches: true },
  { id: "p3", name: "Dana Levi", teaches: true },
  { id: "p4", name: "עידו כץ", teaches: false },
];

// Gray the people without lessons in the dropdown only; the selected value
// itself shows as plain text.
const renderPerson = (person: Person) => (
  <span style={person.teaches ? undefined : { color: "rgba(0, 0, 0, 0.45)" }}>
    {person.name}
  </span>
);

const PickDemo = () => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <Space direction="vertical">
      <TextSearch
        mode="pick"
        items={PEOPLE}
        getText={p => p.name}
        getKey={p => p.id}
        renderOption={renderPerson}
        value={value}
        onSelect={p => setValue(p?.id)}
        placeholder="בחר איש צוות"
        style={{ minWidth: 220 }}
      />
      <Typography.Text>{`value: ${value ?? ""}`}</Typography.Text>
    </Space>
  );
};

// The caller renders the filtered list itself, as on the Students page.
const FilterDemo = () => {
  const [text, setText] = useState("");
  return (
    <Space direction="vertical">
      <TextSearch
        mode="filter"
        items={PEOPLE}
        getText={p => p.name}
        value={text}
        onChange={setText}
        placeholder="חפש לפי שם..."
        style={{ minWidth: 220 }}
      />
      <ul>
        {filterByText(PEOPLE, text, p => p.name).map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </Space>
  );
};

const ExtraOptionDemo = () => {
  const [value, setValue] = useState<string | undefined>();
  const [added, setAdded] = useState<string[]>([]);
  const items = [
    ...PEOPLE,
    ...added.map(name => ({ id: name, name, teaches: true })),
  ];
  return (
    <Space direction="vertical">
      <TextSearch
        mode="pick"
        items={items}
        getText={p => p.name}
        getKey={p => p.id}
        value={value}
        onSelect={p => setValue(p?.id)}
        extraOption={{
          label: query => (
            <span style={{ color: "#52c41a" }}>
              <PlusOutlined style={{ marginInlineEnd: 8 }} />
              {`הוסף: ${query}`}
            </span>
          ),
          onSelect: query => {
            setAdded(prev => [...prev, query]);
            setValue(query);
          },
        }}
        placeholder="הקלד שם שלא ברשימה"
        style={{ minWidth: 220 }}
      />
      <Typography.Text>{`value: ${value ?? ""}`}</Typography.Text>
    </Space>
  );
};

const meta: Meta = {
  title: "Components/TextSearch",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const Pick: Story = { render: () => <PickDemo /> };

export const Filter: Story = { render: () => <FilterDemo /> };

export const ExtraOption: Story = { render: () => <ExtraOptionDemo /> };
