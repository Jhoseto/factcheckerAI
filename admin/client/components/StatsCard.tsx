interface StatsCardProps {
    label: string;
    value: string | number;
    sub?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, sub }) => (
    <div className="p-5 bg-[#252525] border border-[#333] rounded-sm">
        <p className="text-[8px] font-black text-[#666] uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-[#C4B091]">{value}</p>
        {sub && <p className="text-[9px] text-[#888] mt-1">{sub}</p>}
    </div>
);
