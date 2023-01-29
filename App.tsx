import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, IconButton, Button, Text, Dialog, Portal, Provider, TextInput, List, FAB, Modal, MD3Colors } from 'react-native-paper';
import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { LocationObject } from 'expo-location';
import { Sijainti, DialogiData, ModalData } from './types';

const db: SQLite.WebSQLDatabase = SQLite.openDatabase("sijantilista.db");

db.transaction(
  (tx: SQLite.SQLTransaction) => {
    //tx.executeSql(`DROP TABLE sijainnit`);
    tx.executeSql(`CREATE TABLE IF NOT EXISTS sijainnit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tunniste TEXT,
                    ohjeistus TEXT,
                    latitude INTEGER,
                    longitude INTEGER,
                    pvm TEXT,
                    aika TEXT
                  )`);
  },
  (err: SQLite.SQLError) => {
    console.log(err)
  }
);

const App: React.FC = (): React.ReactElement => {

  const [dialogi, setDialogi] = useState<DialogiData>({ auki: false, tunnisteTeksti: "", ohjeTeksti: "" });
  const [sijainnit, setSijainnit] = useState<Sijainti[]>([]);
  const [modal, setModal] = useState<ModalData>({ auki: false, poistaYksi: undefined, poistettava: undefined });
  const [location, setLocation] = useState<LocationObject>();
  const [errorMsg, setErrorMsg] = useState<string>("");

  const tyhjennaSijaintilista = (): void => {
    db.transaction(
      (tx: SQLite.SQLTransaction) => {
        tx.executeSql(`DELETE FROM sijainnit`, [],
          (_tx: SQLite.SQLTransaction, rs: SQLite.SQLResultSet) => {
            haeSijainnit();
          });
      },
      (err: SQLite.SQLError) => console.log(err));
    setModal({ ...modal, auki: false });
  };

  const varmistaPoisto = (id: number) => {
    setModal({ ...modal, auki: true, poistaYksi: true, poistettava: id });
  };

  const poistaSijainti = (id: number | undefined) => {
    if (id) {
      db.transaction(
        (tx: SQLite.SQLTransaction) => {
          tx.executeSql(`DELETE FROM sijainnit WHERE id= ?`, [id],
            (_tx: SQLite.SQLTransaction, rs: SQLite.SQLResultSet) => {
              haeSijainnit();
            });
        },
        (err: SQLite.SQLError) => console.log(err));
    }
    setModal({ ...modal, auki: false, poistaYksi: undefined, poistettava: undefined });
  };

  const getLocationPermission = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      return status;
    }
  };

  const lisaaSijainti = async (): Promise<void> => {
    let locationAllowed = await getLocationPermission();

    if (locationAllowed) {
      let location = await Location.getCurrentPositionAsync({});
      if (location) {
        setLocation(location);
        setDialogi({ ...dialogi, auki: true });
      } else {
        setErrorMsg("Sijaintitiedon haku epäonnistui");
      }
    } else {
      setErrorMsg("Sijaintitiedon käyttö estetty, uutta sijaintia ei voi tallentaa.");
    }
  };

  const tallennaSijaintiTiedot = (): void => {
    let datetime = new Date(location?.timestamp ?? "");

    const uusiSijaintitieto = {
      tunniste: dialogi.tunnisteTeksti,
      ohjeistus: dialogi.ohjeTeksti,
      latitude: location?.coords.latitude,
      longitude: location?.coords.longitude,
      pvm: datetime.toLocaleDateString('fi-FI'),
      aika: datetime.toLocaleTimeString('fi-FI'),
    }

    db.transaction(
      (tx: SQLite.SQLTransaction) => {
        tx.executeSql(`INSERT INTO sijainnit (tunniste, ohjeistus, latitude, longitude, pvm, aika) VALUES (?, ?, ?, ?, ?, ?)`,
          [uusiSijaintitieto.tunniste,
          uusiSijaintitieto.ohjeistus,
          uusiSijaintitieto.latitude || null,
          uusiSijaintitieto.longitude || null,
          uusiSijaintitieto.pvm || null,
          uusiSijaintitieto.aika || null],
          (_tx: SQLite.SQLTransaction, rs: SQLite.SQLResultSet) => {
            haeSijainnit();
          });
      },
      (err: SQLite.SQLError) => console.log(err));

    setDialogi({ ...dialogi, auki: false, ohjeTeksti: "", tunnisteTeksti: "" })
    setLocation(undefined);
  };

  const haeSijainnit = (): void => {
    db.transaction(
      (tx: SQLite.SQLTransaction) => {
        tx.executeSql(`SELECT * FROM sijainnit`, [],
          (_tx: SQLite.SQLTransaction, rs: SQLite.SQLResultSet) => {
            setSijainnit(rs.rows._array);
          });
      },
      (err: SQLite.SQLError) => console.log(err));
  };

  useEffect(() => {
    haeSijainnit();
  }, []
  );

  return (
    <Provider>
      <Appbar.Header>
        <Appbar.Content title="Sijaintimuistio" />
      </Appbar.Header>

      <ScrollView style={{ padding: 20 }}>
        <Text variant='headlineSmall'>Tallennetut sijainnit</Text>

        {(sijainnit.length > 0)
          ? sijainnit.map((sijainti: Sijainti, idx: number) => {
            return (
              <List.Item
                title={sijainti.tunniste}
                key={idx}
                descriptionNumberOfLines={5}
                description={`${sijainti.ohjeistus}` + `\nGPS: ${sijainti.latitude}, ${sijainti.longitude}` +
                  `\nAika: ${sijainti.pvm} klo ${sijainti.aika}`}
                left={props => <List.Icon {...props} icon="map-marker" />}
                right={props => <IconButton icon="delete" iconColor={MD3Colors.error50}
                  size={30} onPress={() => varmistaPoisto(sijainti.id)} />}
              />
            )
          })
          : <Text variant='bodyLarge'>Ei tallennettuja sijainteja</Text>
        }
        {
          (Boolean(errorMsg))
            ? <Text variant="bodyLarge" style={styles.errorMessage}>{errorMsg}</Text>
            : null
        }

        <Portal>
          <Modal
            visible={modal.auki}
            dismissable={false}
            onDismiss={() => setModal({ ...modal, auki: false })}
            contentContainerStyle={styles.modalStyle}>

            {
              modal.poistaYksi
                ? <Text variant='labelLarge'>Haluatko varmasti poistaa sijainnin?</Text>
                : <Text variant='labelLarge'>Haluatko varmasti poistaa kaikki tiedot?</Text>
            }

            <View style={styles.buttonGroupModal}>
              {
                modal.poistaYksi
                  ? <FAB
                    variant='primary'
                    onPress={() => poistaSijainti(modal.poistettava)}
                    icon='check-circle'
                    color='#008000'
                    label='OK'
                    size='small'
                    style={styles.modalOkNappi}
                  />
                  : <FAB
                    variant='primary'
                    onPress={tyhjennaSijaintilista}
                    icon='check-circle'
                    color='#008000'
                    label='OK'
                    size='small'
                    style={styles.modalOkNappi}
                  />
              }
              <FAB
                variant='primary'
                icon='close-circle'
                color='#FF0000'
                onPress={() => setModal({ ...modal, auki: false, poistaYksi: undefined, poistettava: undefined })}
                label='Peruuta'
                size='small'
                style={styles.modalPeruutaNappi}
              />
            </View>
          </Modal>

          <Dialog
            visible={dialogi.auki}
            onDismiss={() => setDialogi({ ...dialogi, auki: false })}
          >
            <Dialog.Title>Lisää uusi sijaintitieto</Dialog.Title>
            <Dialog.Content>
              <Text variant='bodyMedium'>Sijainti: {location?.coords.latitude}, {location?.coords.longitude} </Text>
              <TextInput
                label="tunniste"
                mode="outlined"
                placeholder='Kirjoita tunniste'
                onChangeText={(tunnisteTeksti: string) => setDialogi({ ...dialogi, tunnisteTeksti: tunnisteTeksti })}
              />
              <TextInput
                label="ohje"
                mode="outlined"
                placeholder='Kirjoita ohje/kuvausteksti'
                onChangeText={(ohjeTeksti: string) => setDialogi({ ...dialogi, ohjeTeksti: ohjeTeksti })}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDialogi({ ...dialogi, auki: false })}>Peruuta</Button>
              <Button onPress={tallennaSijaintiTiedot}>Lisää listaan</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <StatusBar style="auto" />
      </ScrollView>

      <View style={styles.buttonGroupFront}>
        <FAB
          style={styles.modalOkNappi}
          icon="plus"
          onPress={lisaaSijainti}
          label="Lisää sijainti"
          disabled={(Boolean(errorMsg))}
        />

        <FAB
          style={styles.modalPeruutaNappi}
          color="red"
          icon="delete"
          onPress={() => setModal({ ...modal, auki: true })}
          label="Tyhjennä lista"
        />
      </View>
    </Provider >
  );
};

const styles = StyleSheet.create({
  errorMessage: {
    backgroundColor: '#E9967A',
    marginTop: 15,
    padding: 10
  },
  modalStyle: {
    backgroundColor: '#DCDCDC',
    padding: 20,
    marginLeft: 10,
    marginRight: 10
  },
  buttonGroupModal: {
    justifyContent: 'space-evenly',
    flexDirection: 'row-reverse',
  },
  buttonGroupFront: {
    flex: 1,
    justifyContent: 'space-evenly',
    flexDirection: 'row-reverse',
    position: 'absolute',
    bottom: 0,
  },
  modalOkNappi: {
    margin: 16,
  },
  modalPeruutaNappi: {
    margin: 16,
  },
});

export default App;