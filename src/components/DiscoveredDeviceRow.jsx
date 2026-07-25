import './DiscoveredDeviceRow.css';

function DiscoveredDeviceRow({ device, isNew }) {
  return (
    <div className="discovered-device-row">
      <span className="discovered-device-row__name">
        {device.name}
        {isNew && <span className="discovered-device-row__new-tag">Nouveau</span>}
      </span>
      <span className="discovered-device-row__reading">{device.reading}</span>
    </div>
  );
}

export default DiscoveredDeviceRow;
