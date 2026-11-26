import { getToken } from '@/components/auth/auth';
import { BASE_URL } from '@/constants/api';
import NoTransactions from '@/components/no-transactions';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


const user_data_token = "dashboard_data";

const saveDashboardData = async (data: any) => {
  try {
    await SecureStore.setItemAsync(
      user_data_token,
      JSON.stringify(data)
    );
  } catch (error) {
    console.error("Error saving dashboard data:", error);
  }
};

const fetchLocalData = async () => {
  try{
    const data = await SecureStore.getItemAsync(user_data_token);
    if(data != null && data){
      return JSON.parse(data);
    }
  }catch(e){
    console.log(e)
  }
}




const saveTransactions = async (data : any) => {
  try {
    await SecureStore.setItemAsync("p-transactions", data);
    console.log("saved !")
  } catch (error) {
    console.error('Error saving token:', error);
  }
}


const getTransactions = async () => {
  try {
    const stored = await SecureStore.getItemAsync("p-transactions");

    if (!stored) return [];
    // console.log(stored)
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return null;
  }
};


export default function LoginScreen() {
  const [user_token, setUserToken] = useState(null);
  const [phone_number, setPhoneNumber] = useState("");
  const [currency, setCurrency] = useState("K");
  const [balance, setBalance] = useState("-");
  const [transactions, setLastTransactions]= useState([]);
  const [account_type, setAccountType] = useState("main");
  const [isLoading, setIsLoading] = useState(true); 
  const [profileData, setProfileData] = useState<any>(null); 

  const [laodingUserData, setLoadingUserData] = useState(true);
  const [fetchingDataError, setFetchingDataError] = useState(false);
  








  const [CONTACTS, SETCONTACTS] = useState({
    matched: [],
    unmatched: [],
  });


  const [refreshing, setRefreshing] = useState(false);

  const getContacts = async () => {
    try {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Contacts permission denied');
        return [];
      }

      const data = await Contact.getAllDetails(
        [ContactField.FULL_NAME, ContactField.PHONES],
        { limit: 1000, sortOrder: ContactsSortOrder.GivenName },
      );

      return data.filter(
        c => Array.isArray(c.phones) && c.phones.length > 0,
      );
    } catch (error) {
      console.error('Failed to get contacts:', error);
      return [];
    }
  };

  const extractPhoneNumbers = (contacts) => {
    return contacts
      .flatMap(contact =>
        contact.phones?.map(p => p.number) || []
      )
      .filter(Boolean);
  };

  const syncContacts = async (phoneNumbers : any) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/verify_contacts.php`,{
          phone_numbers: phoneNumbers,
        },{
          timeout: 15000,
        }
      );

      if (res.data.success) {
        SETCONTACTS({
          matched: res.data.matched_users,
          unmatched: res.data.unmatched_numbers,
        });

        console.log("Matched users:", res.data.matched_users);
        // console.log("Unmatched numbers:", res.data.unmatched_numbers);
      } else {
        // console.warn("Backend rejected payload:", res.data);
      }
    } catch (err) {
      console.error("Network / API error:", err);
    }
  };






  useEffect(() => {
    (async () => {
      try {
        const contacts = await getContacts();

        const filtered = contacts.filter(
          c => c.phones && c.phones.length > 0
        );

        const phoneNumbers = extractPhoneNumbers(filtered);
        await syncContacts(phoneNumbers);

      } catch (e) {
        console.error("Contact sync failed:", e);
      }
    })();
  }, []);


  const fetchLocalData = async () => {
    try {
      const stored = await SecureStore.getItemAsync("dashboard_data");
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load local data", e);
      return null;
    }
  };


  useEffect(() => {
    (async () => {
      const userLocalData = await fetchLocalData();

      if (userLocalData?.data) {
        const d = userLocalData.data;

        setProfileData(d);
        setBalance(d.wallet?.balance ?? "-");
        setCurrency(d.wallet?.currency ?? "K");
        setLastTransactions(d.transactions ?? []);
        setPhoneNumber(d.phone_number ?? "");
        setAccountType(d.wallet?.type ?? d.wallet?.main ?? "main");
      }

      const transactions = await getTransactions();
      // console.log("transaction :" , transactions)
      if (transactions) {
        // console.log("Loaded transactions:", transactions);
        setLastTransactions(transactions);
      }
    })();
  }, []);



  const avatars = {
    avatar1: require('../../assets/images/avatars/avatar1.jpg'),
    avatar2: require('../../assets/images/avatars/avatar2.jpg'),
    avatar3: require('../../assets/images/avatars/avatar3.jpg'),
  };


 

  const fetchDashboardData = async () => {
    setIsLoading(true);

    const userLocalData = await fetchLocalData();

    if (userLocalData?.data) {
      const d = userLocalData.data;

      console.log("user data : ", d)
      setProfileData(d);
      setBalance(d.wallet?.balance ?? "-");
      setCurrency(d.wallet?.currency ?? "K");
      setLastTransactions(d.transactions ?? []);
      setPhoneNumber(d.phone_number ?? "");
      setAccountType(d.wallet?.main ?? "main");
    }

    const token = await getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    console.log("token :", token);

    try {
      const payload = { token };
      const url = `${BASE_URL}/dashboard.php`;

      const res = await axios.post(url, payload, { timeout: 10000 });

      if (res.data.success) {
        setProfileData(res.data.data);
        setBalance(res.data.data.wallet.balance);
        setCurrency(res.data.data.wallet.currency);
        setLastTransactions(res.data.data.transactions);
        setPhoneNumber(res.data.data.phone_number);
        setAccountType(res.data.data.wallet.type ?? 'main');

        await saveDashboardData(res.data);
        await saveTransactions(JSON.stringify(res.data.data.transactions));
      } else {
        // console.log("Fetch failed:", res.data);
      }
    } catch (e) {
      console.error("Dashboard fetch failed:", e);
      setFetchingDataError(true);
    } finally {
      setIsLoading(false);
      setLoadingUserData(false);
    }
  };




  useEffect(() => {
    Promise.resolve().then(fetchDashboardData);
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  const onRefresh = async () => {
    console.log("refreshing")
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };




  const scrollViewRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 500);
  }, []);

  const goToDeposit = ()=>{
    router.push("/deposit_funds")
  }


  const selectContact = async (phoneNumber : any, username : any, p_id : any, avatar : any)=>{
      console.log("selected : ", phoneNumber);
      router.push({
          pathname: "/send_funds",
          params: { 
              id: p_id, 
              name: username,
              phone_number : phoneNumber,
              avatar : avatar
          }
      });
  }
  
  return (
    <View style={{ flex: 1 }}>
      <ParallaxScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2A2A68']} 
            tintColor="#2A2A68" 
          />
        }
        headerBackgroundColor={{ light: '#2A2A68', dark: '#2A2A68' }}
        headerImage={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="flash" size={20} color="#fff" /> 
                <Text style={styles.logoText}>Payreece.</Text>
              </View>

              {laodingUserData ? (
                <View  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View>
                    <ActivityIndicator size={20} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity>
                    <Ionicons name="scan-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              
              
              
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Your balance is</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceAmount}>
                  {currency} {balance}
                </Text>
                {transactions.length > 0 && (
                  <Text style={styles.dateBadge}>
                    {formatDistanceToNow(transactions[0].date, { addSuffix: true })}
                  </Text>
                )}
              </View>
              
              <View style={styles.balanceFooter}>
                
                {transactions.length > 0 && (
                  <Text style={styles.balanceSubtext}>
                    {transactions[0].type == "deposit" ? (
                      <Text>+ K{transactions[0].amount}</Text>
                    ) : transactions[0].type == "transfer" ? (
                      <View>
                        {transactions[0].from_me ? (
                          <Text style={styles.balanceSubtext}>- Sent K{transactions[0].amount}</Text>
                        ) : (
                          <Text style={styles.balanceSubtext}>+ Received K{transactions[0].amount}</Text>
                        )}
                      </View>
                    ) : (
                      <Text></Text>
                    )}
                  </Text>
                )}

                <Text style={styles.balanceSubtext}>+ Card {phone_number.substring(0, 4)}...</Text>
              </View>
            </View>
          </View>
        }>

        <ThemedView style={styles.bodyContainer}>
          <View style={styles.sectionContainer}>

            {CONTACTS.matched.length > 0 && (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderFlex}>
                  <Text style={styles.sectionTitle}>Send Money</Text>
                  {/* <Text style={styles.seeAllContactsText}>See all</Text> */}
                </View>

              </View>
            )}
            
            
            {CONTACTS.matched.length == 0 ? (
              <View>
                 {/* <ScrollView 
                    ref={scrollViewRef}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    horizontal showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.avatarList}
                  >

                    <TouchableOpacity onPress={()=> {
                        router.push("/explore");
                    }} style={styles.addAvatarBtn}>
                        <Ionicons name="add" size={24} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={()=> {
                        router.push("/explore");
                    }} style={styles.addAvatarBtn}>
                        <Ionicons name="add" size={24} color="#000" />
                    </TouchableOpacity>


                    
                    


                  </ScrollView> */}
              </View>
            ) : (
              <View>
                  <ScrollView 
                    ref={scrollViewRef}
                    refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#2A2A68']}
                        tintColor="#2A2A68"  
                      />
                    }
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    horizontal showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.avatarList}
                  >

                    <TouchableOpacity onPress={()=> {
                        router.push("/contacts");
                    }} style={styles.addAvatarBtn}>
                        <Ionicons name="add" size={24} color="#000" />
                    </TouchableOpacity>

                    
                    {CONTACTS.matched.map((contact, index) =>(
                      <TouchableOpacity key={index} onPress={()=>{
                        selectContact(contact.phone_number, contact.fullname, contact.public_id, contact.avatar);
                      }}>
                        <View key={index} style={styles.avatarContainer}>
                          <Image source={avatars[`avatar${index + 1}`]} style={styles.avatar} />
                          <Text style={styles.avatarName}>
                            {contact.fullname?.length > 14
                              ? contact.fullname.slice(0, 10) + '…'
                              : contact.fullname}

                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}


                  </ScrollView>
              </View>
            )}
            


          </View>

          <View style={styles.sectionContainer}>
            <TouchableOpacity
              onPress={() => router.push('/marketplace')}
              style={styles.marketplaceCard}
            >
              <Ionicons name="people-outline" size={24} color="#4C6FFF" />
              <View style={styles.marketplaceCopy}>
                <Text style={styles.marketplaceTitle}>Mobile Money Agents</Text>
                <Text style={styles.marketplaceSubtitle}>Find an agent or start serving customers</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionContainer}>
              {transactions.length > 0 && (
                <View style={styles.sectionContainerHeader}>
                  <Text style={styles.sectionTitle}>Recent </Text>
                  <TouchableOpacity onPress={()=>{
                     router.push("/transactions") 
                  }}>
                    <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                </View>
              )}
              
            
            {transactions.length > 0 ? (
              <View>
                {transactions.map((trans, index) => (
                <TouchableOpacity onPress={() => router.push({
                    pathname: "/transaction", 
                    params: trans 
                  })} 
                  key={index} 
                  style={styles.transactionRow}>

                  {trans.type == "deposit" ? (
                    <View style={styles.transactionIconDeposit}>
                      <Feather name="arrow-down-left" size={24} color="#4A4AFF" />
                    </View>
                  ) : trans.type == "transfer" ?  (  
                      <View>
                        {trans.from_me ? (
                          <View style={styles.transactionIconSend}>
                            <Feather name="arrow-up-right" size={24} color="#646775" />
                          </View>
                        ):(
                          <View style={styles.transactionIconReceive}>
                            {/* <Text>To me</Text> */}
                            <Feather name="arrow-down-left" size={24} color="#3EB489" />
                          </View>
                        )}
                      </View>
                  ) : (
                    <View style={styles.transactionIconDeposit}>
                      <Text>Withdraw</Text>
                      <Feather name="arrow-down-left" size={24} color="#3EB489" />
                    </View>
                  )}




                  <View style={styles.transactionInfo}>
                    {trans.type == "deposit" && (
                      <View>
                        <Text style={styles.transactionName}>
                          Deposit
                        </Text>
                      </View>
                    )}

                    {trans.type == "transfer" && (
                      <View> 
                        {trans.from_me ? (
                          <Text style={styles.transactionName}>
                            Sent to {trans.other_sender_name}
                          </Text>
                        ) : (
                          <Text style={styles.transactionName}>
                            From {trans.other_sender_name}
                          </Text>
                        )}
                      </View>
                    )}

                    
                    <Text style={styles.transactionDate}>
                     {formatDistanceToNow(trans.date, { addSuffix: true })}
                    </Text>
                    
                  </View>
                  <View>
                    {trans.type == "deposit" && (
                      <Text style={styles.transactionSenderDetail}>
                        0{trans.sender_id}
                      </Text>
                    )}
                    <Text style={[styles.transactionAmount, { color: "#559" }]}>
                      K{trans.amount}
                    </Text>
                  </View>
                
                </TouchableOpacity>
              ))}
              </View>
            ) : (
              <View>  
                <NoTransactions onDepositPress={goToDeposit}/>
              </View>
            )}
            
            

          </View>
        
          <View style={{ height: 100 }} />
        </ThemedView>
      </ParallaxScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 55, 
    backgroundColor: '#2A2A68', 
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Arial', android: 'sans-serif' }),
  },
  balanceContainer: {
    gap: 5,
  },
  balanceLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  dateBadge: {
    color: '#fff',
    fontSize: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  balanceSubtext: {
    color: '#a0a0d0',
    fontSize: 12,
  },


  
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 30,
    marginTop: -30, 
    marginLeft: -30, 
    marginRight: -30,  
    marginBottom: -30,  
    padding: 24,
    minHeight: 800, 
  },
  sectionContainer: {
    // marginBottom: 10,
  },
  sectionContainerHeader: {
    // borderWidth : 1,
    display : "flex",
    justifyContent : "space-between",
    flex : 1,
    flexDirection: 'row',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 1,
  },
  sectionHeaderFlex :{
    flex : 1,
    display : "flex",
    justifyContent : "space-between",
    alignContent:"space-between",
    flexDirection : "row"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  marketplaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  marketplaceCopy: {
    flex: 1,
  },
  marketplaceTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  marketplaceSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 3,
  },
  seeAllContactsText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    color : "#758396"
  },

  friendsText : { 
    fontSize: 14,
    marginBottom: 15,
    color : "#8993A3"
  },

  seeAllText : {
    fontSize: 14,
    fontWeight: '500',
    color : "#75798A"
  },
  
  avatarList: {
    gap: 15,
    alignItems: 'center',
    paddingBottom: 20,
  },
  addAvatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.4,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarName: {
    fontSize: 12,
    color: '#666',
  },

  // TRANSACTIONS
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  transactionIconDeposit : {
    borderWidth : 1.2, 
    padding : 10,
    marginRight : 10,
    borderRadius : 5,
    borderColor : "#C2C2FF",
    backgroundColor : "##E6E6FF"
  },
   transactionIconSend : {
    borderWidth : 1.2, 
    padding : 10,
    marginRight : 10,
    borderRadius : 5,
    borderColor : "#BEBECC",
    backgroundColor : "#F1F2F3"
  },
  transactionIconReceive : {
    borderWidth : 1.2, 
    padding : 10,
    marginRight : 10,
    borderRadius : 5,
    borderColor : "#DAF0DF",
    backgroundColor : "#FAFFFB"
  },
   transactionIconTransfer : {
    borderWidth : 1.2, 
    padding : 10,
    marginRight : 10,
    borderRadius : 5,
    borderColor : "#839AF7",
    backgroundColor : "#F5F7FF"
  },
  transactionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  transactionSenderDetail: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7E8794',
    marginLeft : 10
  },
  transactionDate: {
    fontSize: 12,
    color: '#557',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    textAlign: "right"
  },

  // BOTTOM NAVIGATION
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 35,
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2A2A68',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30, // Raise it up
    shadowColor: '#2A2A68',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 10,
    color: '#666',
  },
});