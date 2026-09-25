import React from 'react';

export const PersonLabel: React.FC<{
  name?: string | null;
  id?: string | null;
  empty?: string;
}> = ({ name, id, empty = 'User information unavailable' }) => {
  if (name?.trim()) return <span>{name}</span>;
  return (
    <span>
      {empty}
      {id && (
        <span className="mt-0.5 block font-mono text-[10px] text-lv-faint" title="Technical identifier">
          ID {id}
        </span>
      )}
    </span>
  );
};
