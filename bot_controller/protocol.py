"""Module for the Dotbot protocol API."""

from abc import ABC, abstractmethod
from binascii import hexlify
from dataclasses import dataclass
from enum import Enum
from itertools import chain
from typing import List

PROTOCOL_VERSION = 1


class PayloadType(Enum):
    """Types of DotBot payload types."""

    CMD_MOVE_RAW = 0
    CMD_RGB_LED = 1
    LH2_RAW_DATA = 2
    LH2_LOCATION = 3


class ProtocolPayloadParserException(Exception):
    """Exception raised on invalid or unsupported payload."""


@dataclass
class ProtocolField:
    """Data class that describes a payload field."""

    value: int = 0
    name: str = ""
    length: int = 1
    endian: str = "big"
    signed: bool = False


class ProtocolPayload:
    """Manage a protocol complete payload (header + type + values)."""

    def __init__(self, header, type_, values):
        self.header: ProtocolHeader = header
        self.type: PayloadType = type_
        self.values: ProtocolData = values

    def to_bytes(self) -> bytes:
        """Converts a payload to a bytearray."""
        buffer = bytearray()
        for field in self.header.fields:
            buffer += int(field.value).to_bytes(
                field.length, field.endian, signed=field.signed
            )
        buffer += int(self.type.value).to_bytes(1, "big")
        for field in self.values.fields:
            buffer += int(field.value).to_bytes(
                field.length, field.endian, signed=field.signed
            )
        return buffer

    @staticmethod
    def from_bytes(bytes_: bytes):
        """Parse a bytearray to return a protocol payload instance."""
        header = ProtocolHeader.from_bytes(bytes_[0:19])
        payload_type = PayloadType(int.from_bytes(bytes_[19:20], "big"))
        if payload_type == PayloadType.CMD_MOVE_RAW:
            values = CommandMoveRaw.from_bytes(bytes_[20:25])
        elif payload_type == PayloadType.CMD_RGB_LED:
            values = CommandRgbLed.from_bytes(bytes_[20:24])
        elif payload_type == PayloadType.LH2_RAW_DATA:
            values = Lh2RawData.from_bytes(bytes_[20:60])
        else:
            raise ProtocolPayloadParserException(
                f"Unsupported payload type {payload_type}"
            )
        return ProtocolPayload(header, payload_type, values)

    def __repr__(self):
        header_separators = [
            "-" * (4 * field.length + 2) for field in self.header.fields
        ]
        type_separators = ["-" * 6]  # type
        values_separators = [
            "-" * (4 * field.length + 2) for field in self.values.fields
        ]
        header_names = [
            f" {field.name:<{4 * field.length + 1}}" for field in self.header.fields
        ]
        type_name = [" type "]
        values_names = [
            f" {field.name:<{4 * field.length + 1}}" for field in self.values.fields
        ]
        header_values = [
            f" 0x{hexlify(int(field.value).to_bytes(field.length, field.endian, signed=field.signed)).decode():<{4 * field.length - 1}}"
            for field in self.header.fields
        ]
        type_value = [
            f" 0x{hexlify(int(PayloadType(self.type).value).to_bytes(1, 'big')).decode():<3}"
        ]
        values_values = [
            f" 0x{hexlify(int(field.value).to_bytes(field.length, field.endian, signed=field.signed)).decode():<{4 * field.length - 1}}"
            for field in self.values.fields
        ]
        num_bytes = (
            sum(field.length for field in self.header.fields)
            + 1
            + sum(field.length for field in self.values.fields)
        )
        if num_bytes > 24:
            # put values on a separate row
            separators = header_separators + type_separators
            names = header_names + type_name
            values = header_values + type_value
            return (
                f"{' ' * 17}+{'+'.join(separators)}+\n"
                f" {PayloadType(self.type).name:<16}|{'|'.join(names)}|\n"
                f" {f'({num_bytes} Bytes)':<16}|{'|'.join(values)}|\n"
                f"{' ' * 17}+{'+'.join(separators)}+\n"
                f"{' ' * 17}+{'+'.join(values_separators)}+\n"
                f"{' ' * 17}|{'|'.join(values_names)}|\n"
                f"{' ' * 17}|{'|'.join(values_values)}|\n"
                f"{' ' * 17}+{'+'.join(values_separators)}+\n"
            )

        # all in a row by default
        separators = header_separators + type_separators + values_separators
        names = header_names + type_name + values_names
        values = header_values + type_value + values_values
        return (
            f"{' ' * 17}+{'+'.join(separators)}+\n"
            f" {PayloadType(self.type).name:<16}|{'|'.join(names)}|\n"
            f" {f'({num_bytes} Bytes)':<16}|{'|'.join(values)}|\n"
            f"{' ' * 17}+{'+'.join(separators)}+\n"
        )


class ProtocolData(ABC):
    """Base class for protocol payload data classes."""

    @property
    @abstractmethod
    def fields(self) -> List[ProtocolField]:
        """Returns the list of fields in this data."""

    @staticmethod
    @abstractmethod
    def from_bytes(bytes_):
        """Returns a ProtocolData instance from a bytearray."""


@dataclass
class ProtocolHeader(ProtocolData):
    """Dataclass that holds header fields."""

    destination: int
    source: int
    swarm_id: int
    version: int

    @property
    def fields(self) -> List[ProtocolField]:
        return [
            ProtocolField(self.destination, "dst", 8, "big"),
            ProtocolField(self.source, "src", 8, "big"),
            ProtocolField(self.swarm_id, "swarm id", 2, "big"),
            ProtocolField(self.version, "ver."),
        ]

    @staticmethod
    def from_bytes(bytes_) -> ProtocolData:
        return ProtocolHeader(
            int.from_bytes(bytes_[0:8], "big"),  # destination
            int.from_bytes(bytes_[8:16], "big"),  # source
            int.from_bytes(bytes_[16:18], "big"),  # swarm_id
            int.from_bytes(bytes_[18:19], "big"),  # version
        )


@dataclass
class CommandMoveRaw(ProtocolData):
    """Dataclass that holds move raw command data fields."""

    left_x: int
    left_y: int
    right_x: int
    right_y: int

    @property
    def fields(self) -> List[ProtocolField]:
        return [
            ProtocolField(self.left_x, "lx", 1, "big", True),
            ProtocolField(self.left_y, "ly", 1, "big", True),
            ProtocolField(self.right_x, "rx", 1, "big", True),
            ProtocolField(self.right_y, "ry", 1, "big", True),
        ]

    @staticmethod
    def from_bytes(bytes_) -> ProtocolData:
        return CommandMoveRaw(*bytes_)


@dataclass
class CommandRgbLed(ProtocolData):
    """Dataclass that holds a complete rgb led command fields."""

    red: int
    green: int
    blue: int

    @property
    def fields(self) -> List[ProtocolField]:
        return [
            ProtocolField(self.red, "red"),
            ProtocolField(self.green, "green"),
            ProtocolField(self.blue, "blue"),
        ]

    @staticmethod
    def from_bytes(bytes_) -> ProtocolData:
        return CommandRgbLed(*bytes_)


@dataclass
class Lh2RawLocation(ProtocolData):
    """Dataclass that holds LH2 raw location data."""

    bits: int
    polynomial_index: int
    offset: int

    @property
    def fields(self) -> List[ProtocolField]:
        return [
            ProtocolField(self.bits, "bits", 8),
            ProtocolField(self.polynomial_index, "poly"),
            ProtocolField(self.offset, "off.", 1, "big", True),
        ]

    @staticmethod
    def from_bytes(bytes_) -> ProtocolData:
        return Lh2RawLocation(
            int.from_bytes(bytes_[0:8], "big"),
            int.from_bytes(bytes_[8:9], "big"),
            int.from_bytes(bytes_[9:10], "big", signed=True),
        )


@dataclass
class Lh2RawData(ProtocolData):
    """Dataclass that holds LH2 raw data."""

    locations: List[Lh2RawLocation]

    @property
    def fields(self) -> List[ProtocolField]:
        return list(chain(*[location.fields for location in self.locations]))

    @staticmethod
    def from_bytes(bytes_) -> ProtocolData:
        return Lh2RawData(
            [
                Lh2RawLocation.from_bytes(bytes_[0:10]),
                Lh2RawLocation.from_bytes(bytes_[10:20]),
                Lh2RawLocation.from_bytes(bytes_[20:30]),
                Lh2RawLocation.from_bytes(bytes_[30:40]),
            ]
        )
